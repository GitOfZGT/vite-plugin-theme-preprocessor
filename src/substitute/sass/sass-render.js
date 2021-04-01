/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */

import sass from "@zougt/vite-plugin-theme-preprocessor/original/sass/sass.dart";

import { getSass } from "@zougt/some-loader-utils";

export default getSass({
  implementation: sass,
});
