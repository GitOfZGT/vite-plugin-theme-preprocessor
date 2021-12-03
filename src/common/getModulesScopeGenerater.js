import stringHash from "string-hash";

export function getModulesScopeGenerater(opt) {
    return (name, filename, css) => {
      if ((opt.multipleScopeVars || []).some((item) => item.scopeName === name)) {
        return name;
      }
  
      if (typeof opt.generateScopedName === "function") {
        return opt.generateScopedName(name, filename, css);
      }
  
      const i = css.indexOf(`.${name}`);
      const lineNumber = css.substr(0, i).split(/[\r\n]/).length;
      const hash = stringHash(css).toString(36).substr(0, 5);
      return `_${name}_${hash}_${lineNumber}`;
    };
  }
  
  export default getModulesScopeGenerater;