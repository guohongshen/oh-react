// packages/react 的打包配置
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils.ts";
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } = getPackageJSON('react-noop-renderer');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);
export default [
    // react-noop-renderer
    {
        input: `${pkgPath}/${module}`,
        output: [
            {
                file: `${pkgDistPath}/index.js`,
                name: 'ReactNoopRenderer',
                format: 'umd'
            },
        ],
        external: [...Object.keys(peerDependencies), 'scheduler'], // react-noop-renderer 和 react 公用一个数据共享层
        plugins: [
            ...getBaseRollupPlugins({
                typescript: {
                    exclude: [
                        './packages/react-dom/**/*' // QUESTION 了解下 tsconfig.json include 字段
                    ],
                    tsconfigOverride: {
                        compilerOptions: {
                            paths: {
                                "hostConfig": [`./${name}/src/hostConfig.ts`]
                            }
                        }
                    }
                }
            }),
            // webpack resolve alias
            alias({
                entries: {
                    hostConfig: `${pkgPath}/src/hostConfig.ts`
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
    }
];
