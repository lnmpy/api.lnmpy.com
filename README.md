# api.lnmpy.com

基于 [Cloudflare Workers](https://workers.cloudflare.com/) 与 [Hono](https://hono.dev/) 框架构建的自用 API 集合。

---

## 目录

- [接口列表](#接口列表)
  - [1. Clash 配置转换服务 (`/clash_converter`)](#1-clash-配置转换服务-clash_converter)
  - [2. Google Favicon Base64 转换服务 (`/google_base64_favicon`)](#2-google-favicon-base64-转换服务-google_base64_favicon)

---

## 接口列表

### 1. Clash 配置转换服务 (`/clash_converter`)

根据传入的参数，从 Cloudflare R2 存储读取模版与预设，合并一个或多个 Clash 订阅 URL，自动进行节点倍率过滤、节点别名注入、Emoji 国旗重命名、分组策略构建、规则追加，并通过 QuickJS WASM 安全沙箱支持外部 JS 动态脚本扩充，最终输出完整的 Clash YAML 配置。

- **请求路径**：`/clash_converter`
- **HTTP 方法**：`GET`
- **响应格式**：`text/plain;charset=utf-8` (YAML)

#### 请求参数 (Query Parameters)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :---: | :--- | :--- |
| `url` | `string` | 是 | - | 订阅节点源 URL。若未指定 `profile` 则为必填。支持多种高级用法（详见下方说明）。 |
| `proxy_cost_min` | `number` / `string` | 否 | `0` | 节点倍率过滤下限。正则匹配节点名称中的 `Xx`（如 `0.5x`），低于此倍率的节点将被过滤。 |
| `proxy_cost_max` | `number` / `string` | 否 | `1.5` | 节点倍率过滤上限。正则匹配节点名称中的 `Xx`（如 `2.0x`），高于此倍率的节点将被过滤。 |
| `exclude` | `string` | 否 | - | 节点名称排除关键字，多个关键字使用半角逗号 `,` 分割（例如 `exclude=过期,官网,流量`）。 |
| `script` | `string` | 否 | - | 外部扩展 JS 脚本的 URL（例如 GitHub Gist Raw 地址）。在 QuickJS WASM 隔离沙箱中执行 `main(config)` 函数动态修改配置。 |
| `rules` | `string` | 否 | - | 追加的自定义规则模版, 目前只支持`google_us`。 |


#### `url` 参数高级语法说明

1. **多订阅源合并**：使用竖线 `|` 分割多个 URL。
   - 示例：`url=https://sub1.example.com|https://sub2.example.com`
2. **订阅源命名 / 别名**：在 URL 前加上 `别名::` 格式，该订阅源下的所有节点名称后均会追加 `@别名`。
   - 示例：`url=花云::https://sub1.example.com|vps::https://sub2.example.com`. 方便后续script中识别来源不同的厂商而进行自定义分组. 如chatgpt走节点A,netflix走节点2

#### `script` 动态扩展脚本规范

通过 `script` 参数传入外部 JS 脚本 URL 时，脚本将在 QuickJS WASM 安全沙箱中运行（最大超时限制 2000ms）。脚本中必须定义 `main(config)` 函数并返回修改后的配置对象。

**脚本编写示例**：
```javascript
function main(config) {
  // 参考 https://clashparty.org/docs/guide/override/javascript
  config.rules.unshift("DOMAIN-SUFFIX,openai.com,🚀 节点选择");
  return config;
}
```

#### 响应状态码

| HTTP 状态码 | 含义 | 说明 |
| :---: | :--- | :--- |
| `200` | 成功 | 返回完整的 Clash YAML 文本。 |
| `400` | 请求错误 | 订阅源未包含任何有效节点（`url no proxies`）。 |
| `404` | 未找到 / 参数缺失 | 缺少 `url` 参数（`url parameter missing`）或预设/模板文件不存在。 |
| `500` | 服务器内部错误 | 解析 YAML、加载订阅失败或 QuickJS 沙箱脚本执行异常。 |

#### 请求示例

```bash
# 1. 基础用法
curl "https://api.lnmpy.com/clash_converter?url=https://example.com/clash.yaml"

# 2. 多订阅合并 + 命名别名 + 倍率限制 + 排除特定节点
curl "https://api.lnmpy.com/clash_converter?url=主用::https://sub1.com|备用::https://sub2.com&proxy_cost_min=0&proxy_cost_max=1.5&exclude=官网,过期"

# 3. 自定义规则模版 + 外部 JS 动态处理脚本
curl "https://api.lnmpy.com/clash_converter?url=https://sub.com&script=https://gist.githubusercontent.com/user/raw/script.js"
```

---

### 2. Google Favicon Base64 转换服务 (`/google_base64_favicon`)

传入指定域名，通过 Google Favicon 服务抓取该网站 96px 尺寸的高清图标，并在 Worker 内部将其转换为 Base64 编码的 Data URL 返回。该接口内置 CORS 支持，便于前端应用直接调用。

- **请求路径**：`/google_base64_favicon`
- **HTTP 方法**：`GET`
- **响应格式**：`text/plain;charset=utf-8` (Data URL，形如 `data:image/png;base64,...`)

#### 请求参数 (Query Parameters)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :---: | :--- | :--- |
| `domain` | `string` | 是 | - | 需要获取 Favicon 图标的目标域名（例如 `github.com` 或 `google.com`）。 |

#### 响应状态码

| HTTP 状态码 | 含义 | 说明 |
| :---: | :--- | :--- |
| `200` | 成功 | 返回 Base64 格式的 Data URL 字符串。 |
| `400` | 请求错误 | 缺少 `domain` 参数（`domain required`）或 upstream fetch 错误。 |
| `其他` | 转发状态码 | 透传 Google Favicon 服务的响应状态与错误说明。 |

#### 请求示例

```bash
curl "https://api.lnmpy.com/google_base64_favicon?domain=github.com"
```

**响应示例**：
```text
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADim...
```