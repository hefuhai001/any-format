import { canConvert, convert, detectFormat, listConverters } from '../dist/index.js';

const markdown = `# 报告

一份 **示例** 文档，包含列表和代码。

- 第一项
- 第二项

\`\`\`js
console.log('hi');
\`\`\`

> 引用内容
`;

const html = await convert(markdown, 'markdown', 'html');
console.log('--- markdown -> html ---');
console.log(html.data);
console.log('path:', html.path.join(' -> '));

const plain = await convert(markdown, 'markdown', 'text');
console.log('\n--- markdown -> text (chained) ---');
console.log(plain.data);
console.log('path:', plain.path.join(' -> '));

console.log('\ndetected:', detectFormat(markdown));
console.log('canConvert(markdown, html):', canConvert('markdown', 'html'));
console.log('canConvert(docx, html):', canConvert('docx', 'html'));
console.table(listConverters());
