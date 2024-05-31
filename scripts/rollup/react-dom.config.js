// packages/react 的打包配置
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils.ts";
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';
import { log } from "console";

const { name, module, peerDependencies } = getPackageJSON('react-dom');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);
console.log(pkgDistPath);
console.log(pkgPath);
console.log(module);
export default [
    // react-dom
    {
        input: `${pkgPath}/${module}`,
        output: [
            {
                file: `${pkgDistPath}/index.js`,
                name: 'ReactDOM',
                format: 'umd'
            },
            {
                file: `${pkgDistPath}/client.js`,
                name: 'client',
                format: 'umd'
            },
        ],
        external: [...Object.keys(peerDependencies)], // react-dom 和 react 公用一个数据共享层
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
    // react-test-utils
    {
        input: `${pkgPath}/test-utils.ts`,
        output: [
            {
                file: `${pkgDistPath}/test-utils.js`,
                name: 'testUtils',
                format: 'umd'
            },
            {
                file: `${pkgDistPath}/client.js`,
                name: 'client.js',
                format: 'umd'
            },
        ],
        external: ['react-dom', 'react'], // 防止将 react react-dom 打到 testUtils 里面
        plugins: [
            ...getBaseRollupPlugins(),
        ]
    },
];
