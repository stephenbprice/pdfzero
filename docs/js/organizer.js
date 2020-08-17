(function () {



  // VARIABLES
  const notyf = new Notyf({duration: 4000});

  const logo = document.querySelector('#header img');
  const saveBtn = document.querySelector('#header .download');
  const pdfUploadContainer = document.getElementById('pdf-upload-container');
  const pdfUploadBtn = document.getElementById('pdf-upload-btn');
  const pdfUploadInput = document.getElementById('pdf-upload-input');
  const addFilesBtn = document.getElementById('add-files-btn');
  const addFilesInput = document.getElementById('add-files-input');
  const organizer = document.getElementById('organizer');
  const pagesContainer = document.getElementById('pages-container');

  let pdfjs = null;
  let pdflib = null;
  let sortable = null;

  const resetApp = () => {
    pdfjs = null;
    pdflib = null;
    sortable = null;
    hide(saveBtn);
    hide(organizer);
    show(pdfUploadContainer);
    pagesContainer.innerHTML = '';
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
          renderPDFPages();
          hide(pdfUploadContainer);
          show(organizer);
          show(saveBtn);
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

  const renderPDFPage = (idx) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add('page-wrapper');
    wrapper.setAttribute('data-page-idx', idx);
    pagesContainer.appendChild(wrapper);

    wrapper.innerHTML += "" +
      "<div class='delete-page hidden clickable'>" + 
      "  <i class='material-icons'>delete</i>" +
      "</div>" +
      "<div class='rotate-page hidden clickable'>" +
      "  <i class='material-icons'>rotate_right</i>" +
      "</div>"
    wrapper.addEventListener('mouseenter', (event) => {
      show(event.target.querySelector('.delete-page'));
      show(event.target.querySelector('.rotate-page'));
    });
    wrapper.addEventListener('mouseleave', (event) => {
      hide(event.target.querySelector('.delete-page'));
      hide(event.target.querySelector('.rotate-page'));
    });
    wrapper.querySelector('.delete-page').addEventListener('click', onDeletePage);
    wrapper.querySelector('.rotate-page').addEventListener('click', onRotatePage);

    const canvas = document.createElement('canvas');
    canvas.classList.add('elevated');
    wrapper.appendChild(canvas);
    pdfjs.getPage(idx+1)
      .then(page => {
        pdfz.renderPDFPage(canvas, page, 200);
      })
    ;
  }

  const onDeletePage = async (e) => {
    const pageWrapper = e.target.parentNode.parentNode
    const dataPageIdx = pageWrapper.getAttribute('data-page-idx');
    const pageIdx = parseInt(dataPageIdx, 10);
    await pdflib.removePage(pageIdx);
    pdfjs = await pdfjsLib.getDocument(await pdflib.save()).promise;
    e.target.parentNode.parentNode.remove();
    resetPageOrder();
  }

  const onRotatePage = async (e) => {
    const pageWrapper = e.target.parentNode.parentNode
    const dataPageIdx = pageWrapper.getAttribute('data-page-idx');
    const pageIdx = parseInt(dataPageIdx, 10);
    const page = await pdflib.getPage(pageIdx);
    const prevRotation = await page.getRotation().angle;
    const newRotation = (prevRotation + 90) % 360;
    await page.setRotation(PDFLib.degrees(newRotation));
    pdfjs = await pdfjsLib.getDocument(await pdflib.save()).promise;
    pageWrapper.querySelector('canvas').remove();
    const canvas = document.createElement('canvas');
    canvas.classList.add('elevated');
    pageWrapper.appendChild(canvas)
    pdfjs.getPage(pageIdx+1)
      .then(page => {
        pdfz.renderPDFPage(canvas, page, 200);
      })
    ;
  }

  const resetPageOrder = () => {
    const pages = pagesContainer.children;
    for (let i = 0; i < pages.length; i++) {
      pages[i].setAttribute('data-page-idx', i);
    }
  }

  const addPDFFiles = async (e) => {
    const files = e.target.files;
    if (files.length === 0) return

    loader.loading = true;
    const numPrevPages = pdfjs.numPages;

    const newPDF = await PDFLib.PDFDocument.create();
    let copyPages = await newPDF.copyPages(pdflib, pdflib.getPageIndices());
    copyPages.forEach(page => newPDF.addPage(page));

    const processFile = (f) => {
      return new Promise((resolve, reject) => {
        const filereader = new FileReader();
        filereader.onload = async () => {
          const bytes = new Uint8Array(filereader.result);
          const _pdflib = await PDFLib.PDFDocument.load(bytes);
          copyPages = await newPDF.copyPages(_pdflib, _pdflib.getPageIndices());
          copyPages.forEach(async page => await newPDF.addPage(page));
          resolve();
        }
        filereader.onerror = (e) => {
          reject(e);
        }
        filereader.readAsArrayBuffer(f);
      })
    }

    Array.from(files)
      .reduce((accumulator, f) => {
        return accumulator.then(() => {
          return processFile(f);
        })
      }, Promise.resolve())
      .then(async () => {
        pdflib = newPDF;
        pdfjs = await pdfjsLib.getDocument(await pdflib.save()).promise;
        for (let i = numPrevPages; i < pdfjs.numPages; i++) {
          renderPDFPage(i);
        }
        loader.loading = false;
      })
      .catch((e) => {
        console.log(e)
      })
    ;
  }

  const renderPDFPages = async () => {
    const numPages = pdfjs.numPages;
    for (const idx of Array(numPages).keys()) {
      await renderPDFPage(idx);
    }
    if (!sortable) {
      sortable = Sortable.create(pagesContainer, {
        onUpdate: async (evt) => {
          console.log('updated!');
          const page = await pdflib.getPage(evt.oldIndex);
          pdflib.removePage(evt.oldIndex);
          pdflib.insertPage(evt.newIndex, page);
          resetPageOrder();
        }
      });
    }
  }

  const downloadPDF = async () => {
    download(await pdflib.save(), 'pdfzero.pdf', 'application/pdf');
  }



  // EVENT LISTENERS
  logo.addEventListener('click', () => location.href='index.html');
  saveBtn.addEventListener('click', downloadPDF);
  pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
  pdfUploadInput.addEventListener('change', loadPDFFile);
  addFilesBtn.addEventListener('click', () => addFilesInput.click());
  addFilesInput.addEventListener('change', addPDFFiles);




})();
