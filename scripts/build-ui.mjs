import {build,context} from 'esbuild';
import {resolve} from 'node:path';
import {imagePaths,imageStaticFiles,writeImageManifest} from './image-manifest.mjs';
await writeImageManifest(process.cwd());
const options={entryPoints:['app/card-features.jsx'],outfile:'app/generated/card-features.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],jsx:'automatic',minify:!process.argv.includes('--watch'),define:{'process.env.NODE_ENV':JSON.stringify(process.argv.includes('--watch')?'development':'production')}};
if(process.argv.includes('--watch')){
  const runtime=await context(options);await runtime.watch();
  const assets=await context({entryPoints:['image-inputs'],bundle:true,write:false,plugins:[{name:'image-manifest',setup(build){
    build.onResolve({filter:/^image-inputs$/},()=>({path:'image-inputs',namespace:'image-manifest'}));
    build.onLoad({filter:/.*/,namespace:'image-manifest'},async()=>{await writeImageManifest(process.cwd());return {contents:'',watchFiles:[...imagePaths.map(path=>resolve(process.cwd(),`.${path}`)),...imageStaticFiles.map(path=>resolve(process.cwd(),'app',path))]}});
  }}]});
  await assets.watch();console.log('Observando componentes React e imágenes…')
}
else await build(options);
