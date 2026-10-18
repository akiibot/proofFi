try{const theme=localStorage.getItem('prooffi.theme');document.documentElement.dataset.theme=theme==='light'||theme==='dark'?theme:'system';}catch{document.documentElement.dataset.theme='system';}
