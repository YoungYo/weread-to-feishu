<h1 align="center">WeRead to Feishu</h1>
<div align="center">
将微信读书笔记同步到飞书云文档（覆盖写入）
</div>

## 功能

- [x] 自动读取微信读书书架中有笔记的书籍
- [x] 支持书籍多选
- [x] 支持一键全选
- [x] 支持填写飞书文档地址
- [x] 支持两种鉴权方式：
  - AppId + AppSecret（自动换取 tenant_access_token）
  - 直接填写 tenant_access_token
- [x] 同步时覆盖飞书文档原有内容
- [x] 将微信读书划线/评论/阅读进度汇总为 Markdown 后写入飞书 Docx

## 技术方案（对应飞书接口）

插件同步流程使用了以下飞书接口：

1. 获取 tenant_access_token（当使用 AppId + AppSecret 时）  
   `POST /open-apis/auth/v3/tenant_access_token/internal`
2. 获取文档子块  
   `GET /open-apis/docx/v1/documents/:document_id/blocks/:block_id/children`
3. 批量删除子块（实现覆盖写入）  
   `DELETE /open-apis/docx/v1/documents/:document_id/blocks/:block_id/children/batch_delete`
4. Markdown 转 Docx 块  
   `POST /open-apis/docx/v1/documents/convert`
5. 创建子块（写入新内容）  
   `POST /open-apis/docx/v1/documents/:document_id/blocks/:block_id/children`

## 本地开发

```bash
npm install
npm run dev
```

## 打包

```bash
npm run build
```

构建结果目录：

```text
.output/chrome-mv3
```

## 安装（开发者模式）

1. 在 Chrome 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目构建目录 `.output/chrome-mv3`

## 使用说明

1. 在微信读书网页保持登录状态
2. 点击插件图标打开页面
3. 填写：
   - 飞书文档地址（`https://xxx.feishu.cn/docx/xxxx`）
   - `AppId + AppSecret` 或 `tenant_access_token`
4. 勾选需要同步的书籍（支持一键全选）
5. 点击「开始同步（覆盖原文档）」

## 注意事项

- 当前行为是**覆盖目标文档原有内容**，请确认文档可被重写
- 建议先用测试文档验证权限和写入格式
- 插件会将密钥信息保存在浏览器本地存储中，请勿在不可信设备上使用
