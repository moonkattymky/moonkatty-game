#!/usr/bin/env python3
"""One-off i18n repair from audit 2026-10-07: fill missing keys, fix U+FFFD, drop dead/junk keys.
Edits locales/<code>.js (runtime) and locales/<code>.json (source) in place."""
import json,re,os,sys
D=os.path.dirname(os.path.abspath(__file__));R=os.path.join(D,'..','..','locales')
fill=json.load(open(os.path.join(D,'audit-fill.json')))
fill['de'].update(json.load(open(os.path.join(D,'de-fix.json'))))
keys=json.load(open(os.path.join(D,'repair-keys.json')))
for c in ['es','pt','fr','it','tr','he','ko','zh']:
    fill.setdefault(c,{}).update(zip(keys,json.load(open(os.path.join(D,'repair-'+c+'.json')))))
for c,m in json.load(open(os.path.join(D,'rtl-arrows.json'))).items(): fill.setdefault(c,{}).update(m)
pn=json.load(open(os.path.join(D,'privacy-notice.json')))
for c,v in pn.items():
    if c!='K': fill.setdefault(c,{}).update(zip(pn['K'],v))
dead=json.load(open(os.path.join(D,'dead-keys.json')))
def jsesc(s): return json.dumps(s,ensure_ascii=False)
for code in ['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh']:
    jp=os.path.join(R,code+'.json');sp=os.path.join(R,code+'.js')
    j=json.load(open(jp));st=j['strings']
    src=open(sp).read()
    head,rest=src.split('.strings={',1);body,tail=rest.split('\n};',1) if '\n};' in rest else rest.split('\n };',1)
    # parse body via the json dict ordering: rebuild from JS by evaluating with node is overkill; use regex lines
    m=re.match(r'([\s\S]*)',body)
    import subprocess
    cur=json.loads(subprocess.check_output(['node','-e','const r={};const vm=require("vm");vm.runInContext(require("fs").readFileSync(process.argv[1],"utf8"),vm.createContext(r));process.stdout.write(JSON.stringify(r.MKTYLocales[process.argv[2]].strings))',sp,code]))
    for k in list(cur):
        if 'localStorage' in k or k in dead: cur.pop(k)
    for k in list(st):
        if 'localStorage' in k or k in dead: st.pop(k)
    for k,v in fill.get(code,{}).items(): cur[k]=v; st[k]=v
    lines=',\n'.join('  %s:%s'%(jsesc(k),jsesc(v)) for k,v in cur.items())
    sep='\n};' if '\n};' in rest else '\n };'
    open(sp,'w').write(head+'.strings={\n'+lines+sep+tail)
    json.dump(j,open(jp,'w'),ensure_ascii=False,indent=2);open(jp,'a').write('\n')
print('ok')
