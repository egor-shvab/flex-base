
const M = "font-family:'IBM Plex Mono',monospace";
const IC = (name, size=20, color=null) => '<span style="font-family:\'Material Symbols Rounded\';font-weight:normal;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;font-variation-settings:\'FILL\' 0,\'wght\' 400,\'GRAD\' 0,\'opsz\' 24;font-size:'+size+'px'+(color?';color:'+color:'')+'">'+name+'</span>';
const btn = (label, kind='primary') => {
  const base = 'height:36px;padding:0 16px;border-radius:8px;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;';
  const k = {
    primary:'border:1px solid #1c6b4a;background:#1c6b4a;color:#fff',
    secondary:'border:1px solid #d1d1d6;background:#fff;color:#18181b',
    ghost:'border:1px solid transparent;background:transparent;color:#18181b',
    danger:'border:1px solid #b42318;background:#b42318;color:#fff',
    disabled:'border:1px solid #e4e4e7;background:#f0f0f2;color:#a1a1aa'
  }[kind];
  return '<button style="'+base+k+'">'+label+'</button>';
};
const panel = (tag, inner, tone='neutral') => `
      <div style="border:1px solid #e4e4e7;border-radius:12px;background:#fff;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #ededef;background:#fafafa"><span style="${M};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${tone==='error'?'#b42318':'#8a8a94'}">${tag}</span></div>
        ${inner}
      </div>`;
const state = ({tag, tone='empty', icon, title, body, actions=[], hint}) => {
  const ring = tone==='error' ? 'background:#fdeceb;border:1px solid #f0c8c4;color:#b42318'
            : tone==='info' ? 'background:#e5eefb;border:1px solid #c6d9f4;color:#1a5fb4'
            : 'background:#f6f6f7;border:1px solid #e4e4e7;color:#8a8a94';
  return panel(tag, `<div style="flex:1;min-height:250px;padding:36px 26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center">
          <span style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;${ring}">${IC(icon,24)}</span>
          <span style="font-size:15px;font-weight:600;max-width:340px">${title}</span>
          <span style="font-size:13px;color:#5c5c66;max-width:340px">${body}</span>
          ${actions.length?'<span style="display:flex;gap:8px;margin-top:4px">'+actions.map(a=>btn(a[0],a[1])).join('')+'</span>':''}
          ${hint?'<span style="'+M+';font-size:11px;color:#a1a1aa;margin-top:2px">'+hint+'</span>':''}
        </div>`, tone);
};
const modal = ({tag, width=460, inner}) => panel(tag, `<div style="flex:1;background:#f0f0f2;padding:28px;display:flex;align-items:center;justify-content:center;min-height:250px">
          <div style="width:100%;max-width:${width}px;background:#fff;border:1px solid #d1d1d6;border-radius:14px;box-shadow:0 12px 32px rgba(24,24,27,.16);overflow:hidden">${inner}</div>
        </div>`);
const drawer = ({tag, inner}) => panel(tag, `<div style="flex:1;background:#f0f0f2;padding:20px 0 20px 28px;display:flex;justify-content:flex-end;min-height:250px">
          <div style="width:100%;max-width:400px;background:#fff;border:1px solid #d1d1d6;border-radius:14px 0 0 14px;box-shadow:-8px 0 28px rgba(24,24,27,.12);overflow:hidden">${inner}</div>
        </div>`);
const dlg = ({title, body, fields='', actions}) => `
            <div style="padding:22px 22px 0"><h4 style="font-size:17px;font-weight:600;letter-spacing:-.01em;margin-bottom:6px">${title}</h4><p style="font-size:13px;color:#5c5c66">${body}</p></div>
            ${fields?'<div style="padding:18px 22px 0;display:flex;flex-direction:column;gap:12px">'+fields+'</div>':''}
            <div style="display:flex;justify-content:flex-end;gap:8px;padding:20px 22px;margin-top:18px;border-top:1px solid #ededef;background:#fafafa">${actions.map(a=>btn(a[0],a[1])).join('')}</div>`;
const field = (label, value, opts={}) => `<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:500;color:#3f3f46">${label}${opts.req?' <span style="color:#b42318">*</span>':''}</span><input value="${value}" style="height:36px;padding:0 11px;border:1px solid ${opts.err?'#b42318':'#d1d1d6'};border-radius:8px;font-family:inherit;font-size:14px;background:#fff">${opts.err?'<span style="font-size:12px;color:#b42318">'+opts.err+'</span>':opts.hint?'<span style="font-size:12px;color:#8a8a94">'+opts.hint+'</span>':''}</label>`;
const head = (label, note, meta) => `
    <div style="display:flex;align-items:center;gap:12px;margin:64px 0 14px">
      <span style="${M};font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a8a94">${label}</span>
      <span style="flex:1;height:1px;background:#dcdce0;display:block"></span>
      ${meta?'<span style="'+M+';font-size:11px;color:#8a8a94">'+meta+'</span>':''}
    </div>
    ${note?'<p style="font-size:16px;color:#5c5c66;max-width:800px;margin-bottom:28px">'+note+'</p>':''}`;
const grid = (items, cols=3) => '<div style="display:grid;grid-template-columns:repeat('+cols+',minmax(0,1fr));gap:20px">'+items.join('')+'</div>';
const gridT = (items, cols=3) => '<div style="display:grid;grid-template-columns:repeat('+cols+',minmax(0,1fr));gap:20px;margin-top:20px">'+items.join('')+'</div>';
const sec = inner => '\n\n  <section>'+inner+'\n  </section>';
const phone = (label, inner, bg='#fff') => `
      <div style="display:flex;flex-direction:column;gap:8px"><span style="${M};font-size:11px;color:#8a8a94">${label}</span>
        <div style="width:390px;height:780px;border:1px solid #d1d1d6;border-radius:22px;background:${bg};overflow:hidden;box-shadow:0 8px 24px rgba(24,24,27,.08);display:flex;flex-direction:column;position:relative">${inner}</div>
      </div>`;
const note = (title, body) => '<div style="background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:20px"><h4 style="font-size:14px;font-weight:600;margin-bottom:6px">'+title+'</h4><p style="font-size:13px;color:#5c5c66">'+body+'</p></div>';
const row = inner => '<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">'+inner+'</div>';

return {M,IC,btn,panel,state,modal,drawer,dlg,field,head,grid,gridT,sec,phone,note,row};
