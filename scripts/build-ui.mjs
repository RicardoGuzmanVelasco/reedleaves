import {build,context} from 'esbuild';
const options={entryPoints:['app/card-features.jsx'],outfile:'app/generated/card-features.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],jsx:'automatic',minify:!process.argv.includes('--watch'),define:{'process.env.NODE_ENV':JSON.stringify(process.argv.includes('--watch')?'development':'production')}};
if(process.argv.includes('--watch')){const runtime=await context(options);await runtime.watch();console.log('Observando componentes React…')}
else await build(options);
