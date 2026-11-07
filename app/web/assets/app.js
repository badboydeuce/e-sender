fetch('/health').then(r=>r.json()).then(d=>{document.querySelector('#health').textContent='API status: '+d.status;}).catch(()=>{document.querySelector('#health').textContent='API unavailable';});
