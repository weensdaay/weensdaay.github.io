import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../docs');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml','.txt':'text/plain'};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const requested=decodeURIComponent(url.pathname);
    const target=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));
    if(!target.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    const data=await fs.readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);
  } catch {
    res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}).end(await fs.readFile(path.join(root,'404.html')));
  }
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
