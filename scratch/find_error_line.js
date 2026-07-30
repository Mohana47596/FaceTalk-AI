import fs from 'fs';
import path from 'path';

const dir = 'node_modules/.vite/deps';
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.endsWith('.js') && !file.includes('.map')) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      console.log(`File: ${file} | Total lines: ${lines.length}`);
      if (lines.length >= 35028) {
        console.log(`  Line 35028: ${lines[35027].trim()}`);
        // Print 5 lines before and after
        console.log('  Context:');
        for (let i = Math.max(0, 35022); i < Math.min(lines.length, 35033); i++) {
          console.log(`    ${i + 1}: ${lines[i]}`);
        }
      }
    }
  });
} else {
  console.log('Vite deps directory does not exist.');
}
