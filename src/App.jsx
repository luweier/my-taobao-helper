import React, { useEffect, useMemo, useRef, useState } from "react";

const uid = () => Math.random().toString(36).slice(2);
const pad = (n) => String(n).padStart(2, "0");
const fmtDelta = (ms) => {
  const sign = ms < 0 ? "-" : "";
  const d = Math.abs(ms);
  const h = Math.floor(d / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  const s = Math.floor((d % 60000) / 1000);
  return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
};
function useInterval(cb, delay){
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; }, [cb]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => ref.current && ref.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
const storage = {
  get(k, fb){ try{ const v = localStorage.getItem(k); return v? JSON.parse(v): fb; } catch { return fb; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// simple beep
const sound = {
  ctx: null,
  async ensure(){ if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  async beep(times=1){
    await this.ensure();
    for(let i=0;i<times;i++){
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type="sine"; o.frequency.value=880;
      o.connect(g); g.connect(this.ctx.destination);
      g.gain.setValueAtTime(0.001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime+0.01);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime+0.12);
      o.stop(this.ctx.currentTime+0.13);
      await new Promise(r=>setTimeout(r, 160));
    }
  }
};

export default function App(){
  const [items, setItems] = useState(() => storage.get('tvh_items', []));
  const [profile, setProfile] = useState(() => storage.get('tvh_profile', { name:'', phone:'', note:'' }));
  const [form, setForm] = useState({ title:'', url:'', start:'', prepSec: 10, autoOpen: true });
  const [now, setNow] = useState(Date.now());
  const [notifGranted, setNotifGranted] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => storage.set('tvh_items', items), [items]);
  useEffect(() => storage.set('tvh_profile', profile), [profile]);
  useInterval(() => setNow(Date.now()), 250);

  useEffect(() => {
    const b1 = document.getElementById("btn-audio");
    const b2 = document.getElementById("btn-notif");
    if(b1) b1.onclick = () => sound.ensure();
    if(b2) b2.onclick = async () => {
      try{ const res = await Notification.requestPermission(); setNotifGranted(res === 'granted'); } catch{}
    };
  }, []);

  const sorted = useMemo(() => [...items].sort((a,b) => a.start - b.start), [items]);

  useEffect(() => {
    sorted.forEach(async (i) => {
      const delta = i.start - now;
      if (!i.warned && delta <= i.prepSec * 1000 && delta > -2000) {
        i.warned = true; setItems(arr => arr.map(x => x.id === i.id ? { ...x, warned: true } : x));
        setHighlightId(i.id); setTimeout(() => setHighlightId(null), 1200);
        try{ if (notifGranted && typeof Notification !== 'undefined') new Notification('即将开抢', { body: `${i.title} · ${fmtDelta(delta)} 后开始` }); } catch{}
        sound.beep(2);
      }
      if (!i.opened && delta <= 0) {
        i.opened = true; setItems(arr => arr.map(x => x.id === i.id ? { ...x, opened: true } : x));
        setHighlightId(i.id); setTimeout(() => setHighlightId(null), 1500);
        sound.beep(3);
        if (i.autoOpen) {
          try{
            const a = document.createElement('a');
            a.href = i.url; a.target = '_blank'; a.rel='noopener';
            document.body.appendChild(a); a.click(); a.remove();
          }catch{}
        }
      }
    });
  }, [now, sorted, notifGranted]);

  const addItem = () => {
    if(!form.title.trim() || !form.url.trim() || !form.start) return;
    const id = uid();
    const start = new Date(form.start).getTime();
    const item = { id, ...form, start, opened:false, warned:false };
    setItems(arr => [...arr, item]);
    setForm({ title:'', url:'', start:'', prepSec:10, autoOpen:true });
  };
  const removeItem = (id) => setItems(arr => arr.filter(i => i.id !== id));
  const toggleAuto = (id) => setItems(arr => arr.map(i => i.id === id ? { ...i, autoOpen: !i.autoOpen } : i));
  const openLink = (url) => {
    try{
      const a = document.createElement('a');
      a.href=url; a.target='_blank'; a.rel='noopener';
      document.body.appendChild(a); a.click(); a.remove();
    }catch{}
  };

  return (
    <main className="container">
      <section className="card">
        <div className="title">添加目标</div>
        <div className="row">
          <div style={{flex:'1 1 260px'}}>
            <label>标题</label>
            <input type="text" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="例如：XX餐厅 9.01 午餐券" />
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>链接（https:// 或 taobao:// 深链）</label>
            <input type="text" value={form.url} onChange={e=>setForm({...form, url:e.target.value})} placeholder="粘贴商品页链接" />
          </div>
        </div>
        <div className="row" style={{marginTop:12}}>
          <div style={{flex:'1 1 260px'}}>
            <label>开抢时间</label>
            <input type="datetime-local" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} />
          </div>
          <div style={{width:180}}>
            <label>提前提醒（秒）</label>
            <input type="number" value={form.prepSec} min={0} onChange={e=>setForm({...form, prepSec: Number(e.target.value)||0})} />
          </div>
          <div style={{display:'flex', alignItems:'end'}}>
            <label style={{display:'flex', alignItems:'center', gap:8}}>
              <input type="checkbox" checked={form.autoOpen} onChange={e=>setForm({...form, autoOpen:e.target.checked})} />
              到点尝试新标签打开
            </label>
          </div>
          <div style={{display:'flex', alignItems:'end'}}>
            <button className="primary" onClick={addItem}>添加</button>
          </div>
        </div>
        <p className="note" style={{marginTop:8}}>提示：浏览器可能拦截自动新开页，建议到点前保持此页面激活并点击上面“启用声音/开启通知”。</p>
      </section>

      <section className="card" style={{marginTop:16}}>
        <div className="title">我的目标</div>
        <div className="list">
          {sorted.length === 0 ? <div className="muted">还没有添加目标～</div> : null}
          {sorted.map(i => {
            const delta = i.start - now;
            const starting = delta <= 0;
            const prep = delta <= i.prepSec * 1000 && delta > 0;
            return (
              <div key={i.id} className="item">
                <div className={"grow " + (highlightId===i.id ? "highlight": "")}>
                  <div style={{fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{i.title}</div>
                  <div className="muted" style={{wordBreak:'break-all'}}>{i.url}</div>
                </div>
                <div className="right">
                  <div style={{fontWeight:600, color: starting? '#059669' : prep? '#b45309' : '#111'}}>
                    {starting? '已开始' : fmtDelta(delta)}
                  </div>
                  <div className="muted">提前 {i.prepSec}s 提醒</div>
                </div>
                <div className="row">
                  <button onClick={() => openLink(i.url)}>立即打开</button>
                  <button onClick={() => toggleAuto(i.id)} className={"pill " + (i.autoOpen? "active": "")}>{i.autoOpen? '自动打开✓' : '自动打开'}</button>
                  <button onClick={() => removeItem(i.id)}>删除</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" style={{marginTop:16}}>
        <div className="title">常用信息卡（仅本地保存）</div>
        <div className="grid3">
          <div>
            <label>姓名/昵称</label>
            <input type="text" value={profile.name} onChange={e=>setProfile({...profile, name:e.target.value})} />
          </div>
          <div>
            <label>手机号</label>
            <input type="text" value={profile.phone} onChange={e=>setProfile({...profile, phone:e.target.value})} />
          </div>
          <div>
            <label>备注</label>
            <input type="text" value={profile.note} onChange={e=>setProfile({...profile, note:e.target.value})} />
          </div>
        </div>
        <p className="note" style={{marginTop:8}}>为安全起见，信息仅保存在你的浏览器 LocalStorage 中。</p>
      </section>

      <section className="card" style={{marginTop:16}}>
        <div className="title">开抢前预检清单</div>
        <ul className="check">
          <li>✅ 已登录淘宝账号，完成实名认证</li>
          <li>✅ 付款方式可用（余额/银行卡/花呗等），支付密码已记得</li>
          <li>✅ 目标链接可正常打开；若在手机端，建议使用 App 内打开</li>
          <li>✅ 网络稳定，尽量避免同时进行大流量下载/上传</li>
          <li>✅ 保持本页面前台活跃，已“启用声音/开启通知”</li>
          <li>✅ 熟悉下单流程，尽量减少页面停留与来回跳转</li>
        </ul>
        <p className="note" style={{marginTop:8}}>本工具不提供任何自动化下单或绕过平台规则的能力，仅用于提醒与快速打开目标页面。</p>
      </section>
    </main>
  );
}
