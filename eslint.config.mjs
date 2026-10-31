import globals from "globals";

export default [{
  files:["**/*.{js,jsx,mjs,cjs}"],
  ignores:["node_modules/**","app/generated/**"],
  languageOptions:{
    ecmaVersion:"latest",
    sourceType:"module",
    parserOptions:{ecmaFeatures:{jsx:true}},
    globals:{...globals.browser,...globals.node,...globals.es2025}
  },
  rules:{"no-undef":"error"}
}];
