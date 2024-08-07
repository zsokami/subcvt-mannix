# subcvt-mannix

订阅转换后端 api 反向代理

转为 clash 订阅的专属功能：

- 移除无节点的分组
- 移除错误 uuid 的节点
- 确保 h2 / grpc 的 tls 为 true
- 对 grpc-service-name 进行 URL 解码
- 节点 type 和 cipher 筛选（使用完全匹配的正则表达式）：
  - `type=ssr?|vmess|trojan` 匹配 ss / ssr / vmess / trojan 节点
  - `type!=hysteria2?` 排除 hysteria / hysteria2 节点
  - `type!=vless|hysteria2?` 排除 vless / hysteria / hysteria2  节点
  - `cipher=...`
  - `cipher!=...`
- 支持修改 sni/servername/Host/host：
  - `sni={域名}` 修改所有节点的 sni/servername/Host/host
  - `sni=d` 删除所有节点的 sni/servername/Host/host
  - `sni={sni1}|{sni2}|{sni3}` 依次设置为 sni1 sni2 sni3 sni1...
  - `sni={server1}@{sni1},{server2}@{sni2}|{sni3}|d,{sni4}` 不同 server 设置不同 sni（server 使用部分匹配的正则表达式）
- 支持修改 server：
  - `server={域名/ip}` 修改所有节点的 server
  - `server={server1}|{server2}|{server3}` 依次设置为 server1 server2 server3 server1...
  - `server={sni1}@{server1},{sni2}@{server2}|{server3},{server4}` 不同 sni 设置不同 server（sni 使用部分匹配的正则表达式）

默认 /sub 路径，默认转为 clash 订阅

- `https://api.scmx.cc/?url={原订阅链接}`（随机后端 + 默认配置 + 默认参数）
- `https://api.scmx.cc/api.v1.mk?url={原订阅链接}`（指定后端）
- `https://api.scmx.cc/version`（指定路径）
- `https://api.scmx.cc/api.v1.mk/version`（指定后端和路径）

url 参数快捷方式

- `https://api.scmx.cc/{原订阅链接}`（原订阅链接需 URL 编码）
- `https://api.scmx.cc/?{原订阅链接}`（原订阅链接无需 URL 编码，但如果存在 # 字符则必须编码，否则会被截断）
- `https://api.scmx.cc?config={远程配置}&{原订阅链接}`（同上）

github raw url 快捷方式

`https://api.scmx.cc/r/{owner}/{repo}/{ref}/{path}` -> `https://api.scmx.cc/?url=https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`

其他用法与 https://github.com/tindy2013/subconverter/blob/master/README-cn.md 相同，如：

- `https://api.scmx.cc/?config={远程配置}&url={原订阅链接}`（指定配置）
- `https://api.scmx.cc/?target=mixed&url={原订阅链接}`（指定目标类型）
