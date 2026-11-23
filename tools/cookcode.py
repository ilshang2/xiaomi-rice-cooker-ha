"""米家電子鍋 mini（chunmi.cooker.tw1）cooking-data 封包工具。
格式見 cooker/docs/cookcode-format.md。封包 176 位元組：表頭 20 + 曲線 154 + CRC16/XMODEM(前 174 位元組, 大端)。
用法：
  python cookcode.py list                      # 列出內建食譜
  python cookcode.py show 優格                  # 解析表頭
  python cookcode.py hex 優格 --minutes 300     # 改時長後輸出新封包（自動重算 CRC）
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
def start_index(b):
    """App 的做法：menu id > 4 的食譜立即開始用 index 05（存入收藏用 04）；模式 1–4 保留原值。"""
    if int.from_bytes(b[3:7],'big')>4: b[2]=0x05
    return fix_crc(b)
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('name',nargs='?'); ap.add_argument('--minutes',type=int); ap.add_argument('--order',type=int); ap.add_argument('--keep-warm',choices=['on','off'])
    a=ap.parse_args(); R=load()
    if a.cmd=='list': print('\n'.join(f'{b[6]:02x} {n}' for n,b in R.items()))
    else:
        b=R[a.name]
        start_index(b)
        if a.minutes: set_minutes(b,a.minutes)
        if a.order is not None: set_order(b,a.order)
        if a.keep_warm: set_auto_keep_warm(b,a.keep_warm=='on')
        print(parse(b) if a.cmd=='show' else b.hex())
