# 图标文件夹

这个文件夹用于存放PWA应用图标。

## 需要的图标尺寸

请在此文件夹中放置以下尺寸的PNG图标文件：

- `icon-72x72.png` - 72x72像素
- `icon-96x96.png` - 96x96像素
- `icon-128x128.png` - 128x128像素
- `icon-144x144.png` - 144x144像素
- `icon-152x152.png` - 152x152像素
- `icon-192x192.png` - 192x192像素
- `icon-384x384.png` - 384x384像素
- `icon-512x512.png` - 512x512像素

## 快速生成图标

你可以使用以下工具快速生成所有尺寸的图标：

1. **在线工具**：
   - https://www.pwabuilder.com/imageGenerator
   - https://realfavicongenerator.net/

2. **命令行工具**（如果安装了ImageMagick）：
```bash
# 从原始图标生成所有尺寸
convert original-icon.png -resize 72x72 icon-72x72.png
convert original-icon.png -resize 96x96 icon-96x96.png
convert original-icon.png -resize 128x128 icon-128x128.png
convert original-icon.png -resize 144x144 icon-144x144.png
convert original-icon.png -resize 152x152 icon-152x152.png
convert original-icon.png -resize 192x192 icon-192x192.png
convert original-icon.png -resize 384x384 icon-384x384.png
convert original-icon.png -resize 512x512 icon-512x512.png
```

## 设计建议

- 使用简单、清晰的设计
- 确保在小尺寸下也能清楚识别
- 使用透明背景或纯色背景
- 避免使用过多细节
- 建议尺寸：至少 512x512 像素的原始图
- 格式：PNG（支持透明度）

## 临时方案

在生成正式图标之前，你可以使用以下方式创建简单的占位图标：

```html
<!-- 使用 data URL 创建简单的文字图标 -->
<canvas id="iconCanvas" width="512" height="512"></canvas>
<script>
  const canvas = document.getElementById('iconCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3498db';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 200px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EO', 256, 256);
  // 右键保存图片
</script>
```


