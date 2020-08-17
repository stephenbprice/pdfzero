(function () {



  // VARIABLES
  const notyf = new Notyf({duration: 4000});

  const logo = document.querySelector('#header img');
  const saveBtn = document.querySelector('#header .download');
  const pdfUploadContainer = document.getElementById('pdf-upload-container');
  const pdfUploadBtn = document.getElementById('pdf-upload-btn');
  const pdfUploadInput = document.getElementById('pdf-upload-input');
  const formfiller = document.getElementById('formfiller');
  const flattenFormBtn = document.getElementById('flatten-form-btn');
  const canvasContainer = document.getElementById('formfiller-canvas-container');
  const decrementBtn = document.getElementById('decrement-btn');
  const incrementBtn = document.getElementById('increment-btn');

  let pdfjs = null;
  let pdflib = null;
  let pageNum = null;



  // METHODS
  const resetApp = () => {
    pdfjs = null;
    pdflib = null;
    pageNum = null;
    clearCanvas();
    hide(saveBtn);
    hide(formfiller);
    show(pdfUploadContainer);
  }

  const clearCanvas = () => {
    canvasContainer.innerHTML = '';
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
          pageNum = 1;
          hide(pdfUploadContainer);
          show(saveBtn);
          show(formfiller);
          renderPDFPage();
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

  const decrementPage = () => {
    if (pageNum && pageNum > 1) {
      pageNum -= 1;
      renderPDFPage();
    }
  }

  const incrementPage = () => {
    if (pageNum && pageNum < pdfjs.numPages) {
      pageNum += 1;
      renderPDFPage();
    } 
  }

  const renderPDFPage = async (page) => {
    if (page === undefined) {
      page = await pdfjs.getPage(pageNum);
    }
    clearCanvas();

    const cssUnits = 96 / 72;
    let viewport = page.getViewport(1)
    pageView = new pdfjsViewer.PDFPageView({
      container: canvasContainer,
      scale: 1,
      id: 'formfiller-pageview',
      defaultViewport: viewport,
      annotationLayerFactory: new pdfjsViewer.DefaultAnnotationLayerFactory(),
      renderInteractiveForms: true
    })
    pageView.setPdfPage(page);
    await pageView.draw();
    for (let input of document.querySelectorAll('.textWidgetAnnotation')) {
      input.addEventListener('focusout', handleTextAnnotationChange);
    }
  }

  const handleTextAnnotationChange = async (e) => {
    const section = e.target.parentNode;
    const annotationId = section.getAttribute('data-annotation-id');
    const [objNum, genNum] = pdfz.parsePDFJSAnnotationId(annotationId);
    const acroField = pdfz.getPDFLibObjById(pdflib, objNum, genNum);
    const value = e.target.value;
    await pdfz.updateTextAcroFieldValue(pdflib, acroField, value);
  }

  const flattenForm = async (e) => {
    await pdfz.flattenPDF(pdflib);
    pdfjs = await pdfjsLib.getDocument(await pdflib.save()).promise;
    renderPDFPage();
  }

  const downloadPDF = async () => {
    download(await pdflib.save(), 'pdfzero.pdf', 'application/pdf');
  }



  // EVENT LISTENERS
  logo.addEventListener('click', () => location.href='index.html');
  saveBtn.addEventListener('click', downloadPDF);
  pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
  pdfUploadInput.addEventListener('change', loadPDFFile);
  decrementBtn.addEventListener('click', decrementPage);
  incrementBtn.addEventListener('click', incrementPage);
  flattenFormBtn.addEventListener('click', flattenForm);



})();
