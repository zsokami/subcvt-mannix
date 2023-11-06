# subcvt-mannix

订阅转换后端 api 反向代理 + clash 自动移除无节点的分组

默认 /sub 路径，默认转为 clash 订阅

- `https://sc.me.cd?url={原订阅链接}`（随机后端 + 默认配置 + 默认参数）
- `https://sc.me.cd/api.v1.mk?url={原订阅链接}`（指定后端）
- `https://sc.me.cd/version`（指定路径）
- `https://sc.me.cd/api.v1.mk/version`（指定后端和路径）

其他用法与 https://github.com/tindy2013/subconverter/blob/master/README-cn.md 相同，如：

- `https://sc.me.cd?config={远程配置}&url={原订阅链接}`（指定配置）
- `https://sc.me.cd?target=mixed&url={原订阅链接}`（指定目标类型）
