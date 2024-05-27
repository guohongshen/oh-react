// packages/react 的打包配置
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils.ts";
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';
import { log } from "console";

const { name, module } = getPackageJSON('react-dom');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);
console.log(pkgDistPath);
console.log(pkgPath);
console.log(module);
export default [
    // react
    {
        input: `${pkgPath}/${module}`,
        output: [
            {
                file: `${pkgDistPath}/index.js`,
                name: 'index.js',
                format: 'umd'
            },
            {
                file: `${pkgDistPath}/client.js`,
                name: 'client.js',
                format: 'umd'
            },
        ],
        plugins: [
            ...getBaseRollupPlugins(),
            // webpack resolve alias
            alias({
                entries: {
                    hosCOnfig: `${pkgPath}/src/hostConfig.ts`
                }
            }),
            generatePackageJson({
                inputFolder: pkgPath,
                outputFolder: pkgDistPath,
                baseContents: ({ name, description, version }) => ({
                    name,
                    description,
                    version,
                    peerDependencies: {
                        react: version
                    },
                    main: 'index.js'
                })
            })
        ]
    },
];
