"""米家電子鍋 mini（chunmi.cooker.tw1）cooking-data 封包工具。
格式見 cooker/docs/cookcode-format.md。封包 176 位元組：表頭 20 + 曲線 154 + CRC16/XMODEM(前 174 位元組, 大端)。
用法：
  python cookcode.py list                      # 列出內建食譜
  python cookcode.py show 優格                  # 解析表頭
  python cookcode.py hex 優格 --minutes 300     # 改時長後輸出新封包（自動重算 CRC）
  python cookcode.py hex 優格 --phase 1 --target 45 --power 16   # 實驗：改階段 1 目標溫度與功率
  python cookcode.py hold --hold 65 --minutes 90                  # 自訂恆溫食譜：65 °C 90 分鐘
送給電鍋（HA）：xiaomi_miot.call_action  entity_id=<電鍋實體> siid=4 aiid=1 params=["<hex>"]
"""
import json,sys,argparse,pathlib
DATA=pathlib.Path(__file__).resolve().parent.parent/'data'/'recipes.json'
def crc16_xmodem(b):
    c=0
    for v in b:
        c^=v<<8
        for _ in range(8): c=((c<<1)^0x1021)&0xFFFF if c&0x8000 else (c<<1)&0xFFFF
    return c
def fix_crc(b:bytearray)->bytearray:
    b[174:176]=crc16_xmodem(b[:174]).to_bytes(2,'big'); return b
def load():
    return {r['name']:bytearray.fromhex(r['packet']) for r in json.load(open(DATA,encoding='utf8'))}
def parse(b):
    """欄位定義取自米家電鍋外掛 CMCookProfile（main.bundle）。"""
    return dict(index=b[2],menu_id=int.from_bytes(b[3:7],'big'),
        flags=dict(custom_save=bool(b[7]&0x80),can_order=bool(b[7]&0x40),can_set_auto_keep_warm=bool(b[7]&0x20)),
        cook_min=b[8]*60+b[9],max_min=b[10]*60+b[11],min_min=b[12]*60+b[13],
        order_on=bool(b[14]&0x80),order_min=(b[14]&0x7F)*60+(b[15]&0x7F),auto_keep_warm=bool(b[15]&0x80),
        rice_id=(b[17]<<8)|b[18],taste=b[19],
        crc_ok=crc16_xmodem(b[:174]).to_bytes(2,'big')==bytes(b[174:176]))
def set_minutes(b,minutes):
    b[8],b[9]=divmod(minutes,60); return fix_crc(b)
def set_order(b,minutes):
    """預約：minutes 分鐘後開始（0 取消預約）。"""
    h,m=divmod(minutes,60); b[14]=(0x80 if minutes else 0)|(h&0x7F); b[15]=(b[15]&0x80)|(m&0x7F); return fix_crc(b)
def set_auto_keep_warm(b,on):
    b[15]=(b[15]|0x80) if on else (b[15]&0x7F); return fix_crc(b)
def set_taste(b,v): b[19]=v&0xFF; return fix_crc(b)
def set_rice(b,rice_id): b[17],b[18]=(rice_id>>8)&0xFF,rice_id&0xFF; return fix_crc(b)
def set_phase(b, phase, target_c=None, power=None):
    """實驗功能：改第 phase 筆階段記錄的目標溫度（b2）與加熱功率（b4）。
    記錄從第 26 位元組起每筆 7 位元組：91 b1 b2 78 b4 b5 b6。已在優格階段 1 驗證，其他階段尚未驗證。"""
    o = 26 + 7 * phase
    if b[o] != 0x91: raise ValueError(f"phase {phase} is not an active record")
    if target_c is not None:
        if not 30 <= target_c <= 95: raise ValueError("target must be 30-95 C")
        b[o + 2] = int(target_c)
    if power is not None:
        if not 0 <= power <= 0x40: raise ValueError("power must be 0-64")
        b[o + 4] = int(power)
    return fix_crc(b)
def hold_packet(target_c, minutes, power=32, template='優格'):
    """自訂恆溫食譜：用優格的流程（階段 1＝恆溫保持）做成「以 power 功率控制在 target_c °C、共 minutes 分鐘」。
    階段 1 與階段 8 的目標溫度、功率一起設，避免流程換階段時溫度掉回優格的 40 °C。
    範圍：目標 30–90 °C、1–1440 分鐘、功率 8–64。電鍋自己控溫，時間到自己停（不自動保溫）。"""
    if not 30 <= target_c <= 90: raise ValueError("target must be 30-90 C")
    if not 1 <= minutes <= 1440: raise ValueError("minutes must be 1-1440")
    if not 8 <= power <= 0x40: raise ValueError("power must be 8-64")
    b = load()[template]
    start_index(b); set_minutes(b, minutes); set_auto_keep_warm(b, False)
    set_phase(b, 1, target_c=target_c, power=power)
    set_phase(b, 8, target_c=target_c, power=power)
    return b
def start_index(b):
    """App 的做法：menu id > 4 的食譜立即開始用 index 05（存入收藏用 04）；模式 1–4 保留原值。"""
    if int.from_bytes(b[3:7],'big')>4: b[2]=0x05
    return fix_crc(b)
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('name',nargs='?'); ap.add_argument('--minutes',type=int); ap.add_argument('--order',type=int); ap.add_argument('--keep-warm',choices=['on','off']); ap.add_argument('--phase',type=int); ap.add_argument('--hold',type=int,help='自訂恆溫：目標 °C（搭配 --minutes、--power）'); ap.add_argument('--target',type=int); ap.add_argument('--power',type=int)
    a=ap.parse_args(); R=load()
    if a.cmd=='list': print('\n'.join(f'{b[6]:02x} {n}' for n,b in R.items()))
    elif a.cmd=='hold':
        b=hold_packet(a.hold,a.minutes or 60,a.power or 32); print(b.hex())
    else:
        b=R[a.name]
        start_index(b)
        if a.minutes: set_minutes(b,a.minutes)
        if a.order is not None: set_order(b,a.order)
        if a.keep_warm: set_auto_keep_warm(b,a.keep_warm=='on')
        if a.phase is not None: set_phase(b,a.phase,a.target,a.power)
        print(parse(b) if a.cmd=='show' else b.hex())
