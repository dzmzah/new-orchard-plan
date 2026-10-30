D = 'D:/My AI/NEW ORCHARD/repo-panel/_gen/sprzedaz_src/'
css = open(D + 'rap_style.css', encoding='utf8').read()
extra = """
.wybor{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 26px}
.wybor label{font-size:13px;color:var(--cichy);letter-spacing:.08em;text-transform:uppercase}
.wybor select{font:500 16px 'Jost',sans-serif;padding:8px 12px;border:1px solid var(--ramka);border-radius:10px;background:#fff;color:var(--zielen)}
.male2{font-size:13px;color:var(--cichy)}
.tg{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;white-space:nowrap;background:var(--jasny);color:var(--zielen);margin:1px 0}
.tg.mail{background:#e6eef7;color:#2b5b8a}.tg.meta{background:#efe7f6;color:#6a3d8f}.tg.ig{background:#f7e7ee;color:#93365c}.tg.nz{background:#eee;color:#666}.tg.dir{background:#f3efe2;color:#7a6526}
.bar{height:10px;border-radius:5px;background:var(--akcent);min-width:2px}
.zw .rz span.src{background:none;padding:0}
.kafle{grid-template-columns:repeat(4,1fr)}
.kafel.mocny .zmn{color:#fff!important}
"""
body = open(D + 'sp_body.html', encoding='utf8').read()
js = open(D + 'sp_script.js', encoding='utf8').read()
html = f"""<!DOCTYPE html>
<html lang="pl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sprzedaż na żywo · New Orchard</title>
<link rel="icon" href="../favicon.png">
<meta name="theme-color" content="#2c4d23">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Figtree:wght@400;500;600&display=swap">
<style>
{css}{extra}</style></head><body>
{body}
<script>
{js}</script>
</body></html>
"""
open('D:/My AI/NEW ORCHARD/repo-panel/sprzedaz/index.html', 'w', encoding='utf8').write(html)
print(len(html))
