(function () {



  // VARIABLES
  const FONTS  = {
    Courier: { html: 'Courier New', pdflib: PDFLib.StandardFonts.Courier },
    Helvetica: { html: 'Helvetica', pdflib: PDFLib.StandardFonts.Helvetica },
    TimesRoman: { html: 'Times New Roman', pdflib: PDFLib.StandardFonts.TimesRoman }
  };

  const notyf = new Notyf({duration: 4000});

  const logo = document.querySelector('#header img');
  const saveBtn = document.querySelector('#header .download');
  const pdfUploadContainer = document.getElementById('pdf-upload-container');
  const pdfUploadBtn = document.getElementById('pdf-upload-btn');
  const pdfUploadInput = document.getElementById('pdf-upload-input');
  const editor = document.getElementById('editor');
  const canvas = document.getElementById('editor-canvas');
  const addTextInput = document.getElementById('add-text-input');
  const addTextControls = document.getElementById('add-text-controls');
  const addTextBtn = document.getElementById('add-text-btn');
  const fontInput = document.getElementById('font-selector');
  const fontSizeInput = document.getElementById('font-size-selector');
  const decrementBtn = document.getElementById('decrement-btn');
  const incrementBtn = document.getElementById('increment-btn');


  let pdfjs = null;
  let pdflib = null;
  let pageNum = null;
  let listenAddText = false;
  let listenFinishText = false;



  // METHODS
  const resetApp = () => {
    pdfjs = null;
    pdflib = null;
    pageNum = null;
    listenAddText = false;
    listenFinishText = false;
    clearCanvas();
    hide(saveBtn);
    hide(editor);
    show(pdfUploadContainer);
  }

  const clearCanvas = () => {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, context.width, context.height);
    removeClass(canvas, 'selecting-text-loc');
    listenAddText = false;
    listenFinishText = false;
    hide(addTextControls);
    hide(addTextInput);
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
          show(editor);
          show(saveBtn);
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
    viewport = await pdfz.renderPDFPage(canvas, page);
  }

  const downloadPDF = async () => {
    pdflib.save()
      .then(bytes => { download(bytes, 'pdfzer.pdf', 'appplication/pdf'); throw 'error'; })
      .catch((e) => {
        console.log(e);
      })
  }

  const addTextClicked = () => {
    listenAddText = true;
    addClass(canvas, 'selecting-text-loc');
    show(addTextControls);
  }

  const canvasClicked = async (e) => {
    if (listenAddText) {
      listenAddText = false;
      listenFinishText = true;
      removeClass(canvas, 'selecting-text-loc');
      const x = e.pageX - canvas.getBoundingClientRect().left - window.scrollX;
      const y = e.pageY - canvas.getBoundingClientRect().top - window.scrollY;
      addTextInput.value = '';
      addTextInput.style.left = `${x}px`;
      addTextInput.style.top = `${y}px`;
      addTextInput.style.width = '2ch';
      show(addTextInput)
      addTextInput.focus()
    } else if (listenFinishText) {
      listenFinishText = false;
      const text = addTextInput.value;
      const textRect = addTextInput.getBoundingClientRect();
      const textParentRect = addTextInput.parentElement.getBoundingClientRect();
      const textX = textRect.left - textParentRect.left;
      const textY = textRect.bottom - textParentRect.top;
      const canvasRect = canvas.getBoundingClientRect();
      const canvasW = canvasRect.width;
      const canvasH = canvasRect.height;
      const percentX = textX / canvasW;
      const percentY = 1 - (textY / canvasH); // PDF coords start at bottom

      const font = FONTS[fontInput.value].pdflib;
      const fontSize = parseInt(fontSizeInput.value, 10);
      
      await pdfz.addTextToPDF(pdflib, text, pageNum, percentX, percentY, font, fontSize);
      const bytes = await pdflib.save();
      pdflib = await PDFLib.PDFDocument.load(bytes);
      pdfjs = await pdfjsLib.getDocument(bytes).promise;
      renderPDFPage();
    }
  }

  const resizeAddTextInput = (e) => {
    const oldOffsetBottom = addTextInput.offsetBottom;
    const oldOffsetLeft = addTextInput.offsetLeft;
    addTextInput.style.fontFamily = FONTS[fontInput.value].html;
    addTextInput.style.fontSize = `${fontSizeInput.value * viewport.scale * 72 / 96}pt`;
    addTextInput.style.width = `${addTextInput.value.length + 1}ch`;
    addTextInput.offsetBottom = oldOffsetBottom;
    addTextInput.offsetLeft = oldOffsetLeft;
  }



  // EVENT LISTENERS
  logo.addEventListener('click', () => location.href='index.html');
  saveBtn.addEventListener('click', downloadPDF);
  pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
  pdfUploadInput.addEventListener('change', loadPDFFile);
  decrementBtn.addEventListener('click', decrementPage);
  incrementBtn.addEventListener('click', incrementPage);

  fontInput.addEventListener('change', resizeAddTextInput);
  fontSizeInput.addEventListener('change', resizeAddTextInput);
  addTextBtn.addEventListener('click', addTextClicked);
  canvas.addEventListener('click', canvasClicked);
  addTextInput.addEventListener('input', resizeAddTextInput);

})();
