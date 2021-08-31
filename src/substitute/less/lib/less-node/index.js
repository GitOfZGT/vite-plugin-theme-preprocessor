/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import lessNode from "@zougt/vite-plugin-theme-preprocessor/original/less/lib/less-node";

import { getLess } from "@zougt/some-loader-utils";

export default getLess({
  implementation: lessNode,
});
