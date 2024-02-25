import gulp from "gulp";

import esbuild from "esbuild";

import { glob } from "glob";

gulp.task("views", function () {
  return gulp.src("src/views/**/*").pipe(gulp.dest("site/"));
});

gulp.task("css", function () {
  return gulp.src("src/css/*.css").pipe(gulp.dest("site/style/"));
});

gulp.task("js", async function () {
  return await esbuild.build({
    entryPoints: await glob("src/js/*.ts"),
    tsconfig: "tsconfig.json",
    format: "esm",
    loader: {
      ".ts": "ts",
    },
    bundle: true,
    splitting: true,
    minify: true,
    sourcemap: true,
    outdir: "site/scripts",
  });
});

gulp.task("default", gulp.parallel("views", "css", "js"));

gulp.task("watch", function () {
  gulp.watch("src/js/**/*.{js,ts}", gulp.parallel("js"));
  gulp.watch("src/css/**/*.{js,less}", gulp.parallel("css"));
  gulp.watch("src/views/**/*", gulp.parallel("views"));
});
