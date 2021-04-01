# @zougt/vite-plugin-theme-preprocessor

一个[vite v2.0+](https://cn.vitejs.dev/)插件，用于实现多个 `less`、`sass` 变量文件编译出多主题的 css

使得基于`less`、`sass`以及`css modules`的主题样式在线动态切换变得很简单

使用了插件钩子：

- config
- configResolved
- buildStart
- generateBundle
- transformIndexHtml

> 注：由于 vite 内置 css 插件未提供外接`less`、`sass`的口子(类似[`webpack-contrib/less-loader`](https://github.com/webpack-contrib/less-loader)的`implementation`)，在`@zougt/vite-plugin-theme-preprocessor`的 buildStart 内替换了相对于根目录的 node_modules 里面的`less`或`sass`

## 安装与使用

```bash
# use npm
npm install @zougt/vite-plugin-theme-preprocessor -D
# use yarn
yarn add @zougt/vite-plugin-theme-preprocessor -D
```

**vite.config.js**

```js
import themePreprocessorPlugin, {
  getModulesScopeGenerater,
} from "@zougt/vite-plugin-theme-preprocessor";
export default {
  plugins: [
    themePreprocessorPlugin({
      scss: {
        multipleScopeVars: [
          {
            scopeName: "theme-default",
            path: path.resolve("src/theme/default-vars.scss"),
          },
          {
            scopeName: "theme-mauve",
            path: path.resolve("src/theme/mauve-vars.scss"),
          },
        ],
        // 默认取 multipleScopeVars[0].scopeName
        defaultScopeName: "",
        // 在生产模式是否抽取独立的主题css文件，extract为true以下属性有效
        extract: true,
        // 独立主题css文件的输出路径，默认取 viteConfig.build.assetsDir 相对于 (viteConfig.build.outDir)
        outputDir: "",
        // 会选取defaultScopeName对应的主题css文件在html添加link
        themeLinkTagId: "theme-link-tag",
        // "head"||"head-prepend" || "body" ||"body-prepend"
        themeLinkTagInjectTo: "head",
        // 是否对抽取的css文件内对应scopeName的权重类名移除
        removeCssScopeName: false,
        // 可以自定义css文件名称的函数
        customThemeCssFileName: (scopeName) => scopeName,
      },
      // less: {
      //   multipleScopeVars: [
      //     {
      //       scopeName: "theme-default",
      //       path: path.resolve("src/theme/default-vars.less"),
      //     },
      //     {
      //       scopeName: "theme-mauve",
      //       path: path.resolve("src/theme/mauve-vars.less"),
      //     },
      //   ],
      // },
    }),
  ],
};
```

## 多主题编译示例（以 sass 为例）

```scss
//src/theme/default-vars.scss
/**
*此scss变量文件作为multipleScopeVars去编译时，会自动移除!default以达到变量提升
*同时此scss变量文件作为默认主题变量文件，被其他.scss通过 @import 时，必需 !default
*/
$primary-color: #0081ff !default;
```

```scss
//src/theme/mauve-vars.scss
$primary-color: #9c26b0;
```

```scss
//src/components/Button/style.scss
@import "../../theme/default-vars";
.un-btn {
  position: relative;
  display: inline-block;
  font-weight: 400;
  white-space: nowrap;
  text-align: center;
  border: 1px solid transparent;
  background-color: $primary-color;
  .anticon {
    line-height: 1;
  }
}
```

编译之后

src/components/Button/style.css

```css
.un-btn {
  position: relative;
  display: inline-block;
  font-weight: 400;
  white-space: nowrap;
  text-align: center;
  border: 1px solid transparent;
}
.theme-default .un-btn {
  background-color: #0081ff;
}
.theme-mauve .un-btn {
  background-color: #9c26b0;
}
.un-btn .anticon {
  line-height: 1;
}
```

### 并且支持 Css Modules

对于`*.module.scss`，得到的 css 类似：

```css
.src-components-Button-style_un-btn-1n85E {
  position: relative;
  display: inline-block;
  font-weight: 400;
  white-space: nowrap;
  text-align: center;
  border: 1px solid transparent;
}
.theme-default .src-components-Button-style_un-btn-1n85E {
  background-color: #0081ff;
}
.theme-mauve .src-components-Button-style_un-btn-1n85E {
  background-color: #9c26b0;
}
.src-components-Button-style_un-btn-1n85E
  .src-components-Button-style_anticon-1n85E {
  line-height: 1;
}
```

## 在线切换主题 css 文件

```js
const toggleTheme = (scopeName = "theme-default") => {
  let styleLink = document.getElementById("theme-link-tag");
  if (styleLink) {
    // 假如存在id为theme-link-tag 的link标签，直接修改其href
    styleLink.href = `/${scopeName}.css`;
    // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
    document.documentElement.className = scopeName;
  } else {
    // 不存在的话，则新建一个
    styleLink = document.createElement("link");
    styleLink.type = "text/css";
    styleLink.rel = "stylesheet";
    styleLink.id = "theme-link-tag";
    styleLink.href = `/${scopeName}.css`;
    // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
    document.documentElement.className = scopeName;
    document.head.append(styleLink);
  }
};
```

webpack 版本的实现方案请查看[`@zougt/some-loader-utils`](https://github.com/GitOfZGT/some-loader-utils#getSass)
