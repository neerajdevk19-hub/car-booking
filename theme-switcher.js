const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'apps/web/src');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.tsx')) {
        arrayOfFiles.push(path.join(__dirname, dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const replacements = {
  'bg-slate-950': 'bg-slate-50',
  'bg-slate-900': 'bg-white',
  'bg-slate-800': 'bg-slate-100',
  'bg-slate-700': 'bg-slate-200',
  'text-slate-100': 'text-slate-900',
  'text-slate-200': 'text-slate-800',
  'text-slate-300': 'text-slate-700',
  'text-slate-400': 'text-slate-500',
  'text-white': 'text-slate-900',
  'border-slate-800': 'border-slate-200',
  'border-slate-700': 'border-slate-300',
  'bg-emerald-500/10': 'bg-emerald-100',
  'bg-purple-500/10': 'bg-purple-100',
  'bg-blue-500/10': 'bg-blue-100',
  'bg-cyan-500/10': 'bg-cyan-100',
  'bg-amber-500/10': 'bg-amber-100',
  'bg-red-500/10': 'bg-red-100',
  'text-slate-500 italic': 'text-slate-400 italic', // fix for rides page
  'bg-slate-900/50': 'bg-white/50',
  'bg-slate-900/80': 'bg-white/80',
  'bg-slate-900/90': 'bg-white/90',
  'hover:bg-slate-700': 'hover:bg-slate-200',
  'hover:bg-slate-800': 'hover:bg-slate-100',
  'hover:border-slate-700': 'hover:border-slate-300',
  'ring-slate-800': 'ring-slate-200',
  'ring-offset-slate-950': 'ring-offset-slate-50'
};

const files = getAllFiles('apps/web/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;
  
  for (const [from, to] of Object.entries(replacements)) {
    // Replace all occurrences using global regex, taking care of word boundaries
    // except for those with / in them
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!-)${escapeRegExp(from)}(?!-)`, 'g');
    content = content.replace(regex, to);
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
