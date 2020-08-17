(function () {



  // VARIABLES
  const notyf = new Notyf({duration: 4000});

  const logo = document.querySelector('#header img');
  const saveBtn = document.querySelector('#header .download');
  const pdfUploadContainer = document.getElementById('pdf-upload-container');
  const pdfUploadBtn = document.getElementById('pdf-upload-btn');
  const pdfUploadInput = document.getElementById('pdf-upload-input');
  const splitter = document.getElementById('splitter');
  const intervalInput = document.getElementById('interval-input');
  const packetsList = document.getElementById('packets-list');

  let pdfjs = null;
  let pdflib = null;

  const resetApp = () => {
    pdfjs = null;
    pdflib = null;
    hide(saveBtn);
    hide(splitter);
    show(pdfUploadContainer);
    packetsList.innerHTML = '';
  }

  const loadPDFFile = (e) => {
    const files = e.target.files;
    if (files.length === 0) {
      resetApp();
    } else {
      loader.loading = true;
      pdfz.loadFile(files[0])
        .then(async (bytes) => {
          pdfjs = await pdfjsLib.getDocument(bytes).promise;
          pdflib = await PDFLib.PDFDocument.load(bytes);
          hide(pdfUploadContainer);
          show(splitter);
          show(saveBtn);
          renderPages();
        })
        .catch(e => {
          resetApp();
          if (e.name === 'PasswordException') {
            notyf.error('Sorry, but PDFZero does not support encrypted PDFs at this time');
          } else {
            notyf.error('Sorry, but we could not open the PDF');
          }
        })
        .finally(() => {
          loader.loading = false;
        })
      ;
    }
  }

  const updateInterval = () => {
    const interval = intervalInput.value
    if (interval <= 0) {
      intervalInput.value = 1;
    } else if (pdfjs.numPages < interval) {
      intervalInput.value = pdfjs.numPages;
    }
    renderPages();
  }

  const renderPages = () => {
    const numPages = pdfjs.numPages;
    const pagesPerFile = parseInt(intervalInput.value, 10);
    const packets = []
    for (let i = 0; i < numPages; i += pagesPerFile) {

      let packetsListItem = document.createElement('li');
      packetsListItem.classList.add('packets-list-item')
      packets.push(packetsListItem);

      let packetPagesList = document.createElement('ul');
      packetPagesList.classList.add('packet-pages-list');
      packetsListItem.appendChild(packetPagesList);

      for (let j = i; j < i + pagesPerFile && j < numPages; j++) {
        const existingPage = document.querySelectorAll(`[data-page-idx='${j}']`);
        if (existingPage.length) {
          packetPagesList.appendChild(existingPage[0]);
        } else {
          const packetPagesListItem = document.createElement('li');
          packetPagesListItem.classList.add('packet-pages-list-item');
          packetPagesListItem.setAttribute('data-page-idx', j);
          packetPagesList.appendChild(packetPagesListItem);

          const canvas = document.createElement('canvas');
          canvas.classList.add('page-canvas');
          canvas.classList.add('elevated');
          packetPagesListItem.appendChild(canvas);
          pdfjs.getPage(j+1)
            .then(page => pdfz.renderPDFPage(canvas, page, 200));
        }
      }

      const existingPackets = document.getElementsByClassName('packets-list-item');
      for (let packet of existingPackets) {
        packet.remove()
      }
      for (let packet of packets) {
        packetsList.appendChild(packet);
      }
    }
  }

  const downloadPDF = async () => {
    const zip = new JSZip();
    const numPages = pdfjs.numPages;
    const pagesPerFile = parseInt(intervalInput.value, 10);
    for (let i = 0; (i * pagesPerFile) < numPages; i += 1) {
      const start = (i * pagesPerFile)
      const pageIndices = pdflib.getPageIndices().slice(start, start + pagesPerFile);

      const packet = await PDFLib.PDFDocument.create();
      const copyPages = await packet.copyPages(pdflib, pageIndices)
      for (let copyPage of copyPages) {
        packet.addPage(copyPage);
      }
      zip.file(`${i+1}.pdf`, await packet.save());
    }
    zip.generateAsync({type: 'blob'})
      .then(blob => {
        download(blob, 'pdfzero.zip', 'application/zip')
      })
  }



  // EVENT LISTENERS
  logo.addEventListener('click', () => location.href='index.html');
  saveBtn.addEventListener('click', downloadPDF);
  pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
  pdfUploadInput.addEventListener('change', loadPDFFile);
  intervalInput.addEventListener('change', updateInterval);



})();
