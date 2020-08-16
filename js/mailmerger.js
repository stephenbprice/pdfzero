(function () {



  // VARIABLES
  const notyf = new Notyf({duration: 4000});

  const logo = document.querySelector('#header img');
  const saveBtn = document.querySelector('#header .download');
  const pdfUploadContainer = document.getElementById('pdf-upload-container');
  const pdfUploadBtn = document.getElementById('pdf-upload-btn');
  const pdfUploadInput = document.getElementById('pdf-upload-input');
  const xlsxUploadContainer = document.getElementById('xlsx-upload-container');
  const xlsxUploadBtn = document.getElementById('xlsx-upload-btn');
  const xlsxUploadInput = document.getElementById('xlsx-upload-input');
  const sheetInputContainer = document.getElementById('sheet-input-container');
  const sheetInputList = document.getElementById('sheet-input-list');
  const mailmerger = document.getElementById('mailmerger');
  const filenameInput = document.getElementById('filename-input');
  const canvasContainer = document.getElementById('mailmerge-canvas-container');
  const canvas = document.getElementById('mailmerger-canvas')
  const decrementBtn = document.getElementById('decrement-btn');
  const incrementBtn = document.getElementById('increment-btn');

  let pdfjs = null;
  let pdflib = null;
  let tribute = null;
  let pageNum = null;
  let xlsxData = null;
  let fields = {};
  let viewport = null;



  // METHODS
  const resetApp = () => {
    pdfjs = null;
    pdflib = null;
    pageNum = null;
    xlsxData = null;
    fields = {};
    viewport = null;
    clearCanvas();
    hide(saveBtn);
    hide(mailmerger);
    sheetInputList.innerHTML = '';
    show(pdfUploadContainer);
  }

  const clearCanvas = () => {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, context.width, context.height);
    for (let field of document.querySelectorAll('.acroField')) {
      field.remove();
    }
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
          show(xlsxUploadContainer);
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

  const loadXLSXFile = (e) => {
    const files = e.target.files;
    if (files.length === 0) {
      resetApp();
    } else {
      loader.loading = true;
      pdfz.loadFile(files[0])
        .then(bytes => XLSX.read(bytes, { type: 'array' }))
        .then(_wb => {
          wb = _wb;
          sheetInputList.innerHTML = '';
          for (let i = 0; i < wb.SheetNames.length; i++) {
            const btn = document.createElement('li');
            btn.classList.add('btn');
            btn.classList.add('sheet-input-btn');
            btn.innerHTML = wb.SheetNames[i];
            btn.setAttribute('data-sheet-idx', i);
            btn.onclick = (e) => {
              setWorksheet(e.target.getAttribute('data-sheet-idx'));
            }
            sheetInputList.appendChild(btn);
          }
          setWorksheet(0);
          hide(xlsxUploadContainer);
          show(mailmerger);
          show(saveBtn);
        })
        .catch(e => {
          console.log(e);
          notyf.error('Sorry, but something went wrong');
        })
        .finally(() => {
          loader.loading = false;
        })
      ;
    }
  }

  const setWorksheet = (i) => {
    for (let b of sheetInputList.querySelectorAll('li')) {
      if (b.classList.contains('active')) {
        b.classList.remove('active');
      }
    }
    if (tribute) {
      tribute.detach(filenameInput);
    }
    filenameInput.value = '';
    fields = {};



    sheetInputList.querySelector(`li[data-sheet-idx='${i}']`).classList.add('active');
    const sheet = wb.Sheets[wb.SheetNames[i]];
    xlsxData = XLSX.utils.sheet_to_json(sheet, { headers: 1 })
    tribute = new Tribute({
      allowSpaces: true,
      values: Object.keys(xlsxData[0]).map(col => { return { key: col, value: col } }),
    })
    tribute.attach(filenameInput);
    renderPDFPage();
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
    renderAcroFields(page);
  }

  const renderAcroFields = async (page) => {
    const annotations = await page.getAnnotations();
    for (let acroField of annotations) {
      if (acroField.subtype && acroField.subtype === 'Widget' && acroField.fieldType === 'Tx') {
        renderTextAcroField(acroField);
      }
    }
  }

  const renderTextAcroField = (acroField) => {
    const width = acroField.rect[2] - acroField.rect[0];
    const height = acroField.rect[3] - acroField.rect[1];
    const viewportClone = viewport.clone({ dontFlip: true, })

    const select = document.createElement('select');
    select.classList.add('acroField');
    let rect = [
      acroField.rect[0],
      canvas.height - acroField.rect[1],
      acroField.rect[2],
      canvas.height - acroField.rect[3]
    ]
    // normalize rect
    var tmp
    if (rect[0] > rect[2]) {
      tmp = rect[0]
      rect[0] = rect[2]
      rect[2] = tmp
    }
    if (rect[1] > rect[3]) {
      tmp = rect[1]
      rect[1] = rect[3]
      rect[3] = tmp
    }
    select.style.transform = `matrix(${viewportClone.transform.join(',')})`
    select.style.transformOrigin = `${-rect[0]}px ${-rect[1]}px`
    select.style.left = `${rect[0]}px`
    select.style.top = `${rect[1]}px`
    select.style.width = `${width}px`
    select.style.height = `${height}px`
    select.setAttribute('data-annotationId', acroField.id);

    let option = document.createElement('option');
    option.value = null;
    option.innerHTML = '-- select --';
    select.appendChild(option);
    for (column of Object.keys(xlsxData[0])) {
      option = document.createElement('option');
      option.value = column
      option.innerHTML = column
      if (fields[acroField.id]) {
        select.value = fields[acroField.id];
      }
      select.appendChild(option)
    }
    select.onchange = (e) => {
      const value = e.target.value;
      const id = e.target.getAttribute('data-annotationId');
      fields[id] = value;
      const matchingFields = document.querySelector(`[data-annotationId='${id}']`);
      for (var field of (matchingFields || [])) {
        field.value = value;
      }
    }
    canvasContainer.appendChild(select);
  }
  const containsInvalidChars = (filenameConvention) => {
    var disallowed_chars = "/\\?%*:|\"<>."
    let cols = Object.keys(xlsxData[0]);
    cols.sort((a,b) => b.length-a.length)
    cols.forEach(col => {
      filename = filename.replace(`@${col}`, '')
    })
    for (var chr of disallowed_chars) {
      if (filename.includes(chr)) {
        return true
      }
    }
    return false
  }
  const getFilenameForRow = (convention, row) => {
    let cols = Object.keys(xlsxData[0]);
    cols.sort((a, b) => b.length - a.length ) // start replacing at longest col name
    cols.forEach(col => {
      var replace_str = ''
      if (Object.keys(row).includes(col) && row[col]) {
        replace_str = row[col]
      }
      convention = convention.replace(`@${col}`, replace_str)
    })
    convention = convention.replace(/\s+/g, ' ')
    return convention
  }
  const downloadPDF = async () => {
    const originalBytes = await pdflib.save();
    const filenameConvention = filenameInput.value;
    const zip = new JSZip();
    loader.loading = true;
    for (let [index, row] of xlsxData.entries()) {
      const pdfCopy = await PDFLib.PDFDocument.load(originalBytes);
      for (let fieldId of Object.keys(fields)) {
        const [objNum, genNum] = pdfz.parsePDFJSAnnotationId(fieldId);
        const annotation = pdfz.getPDFLibObjById(pdfCopy, objNum, genNum);
        await pdfz.updateTextAcroFieldValue(pdfCopy, annotation, row[fields[fieldId]]);
      }
      await pdfz.flattenPDF(pdfCopy);
      const filename = getFilenameForRow(filenameConvention, row);
      zip.file(`${filename}.pdf`, await pdfCopy.save());
    }
    zip.generateAsync({ type: 'blob' })
      .then(blob => {
        download(blob, 'pdfzero.zip', 'application/zip');
      })
      .finally(() => {
        loader.loading = false
      })
    ;
  }

  // EVENT LISTENERS
  logo.addEventListener('click', () => location.href='index.html');
  saveBtn.addEventListener('click', downloadPDF);
  pdfUploadBtn.addEventListener('click', () => pdfUploadInput.click());
  pdfUploadInput.addEventListener('change', loadPDFFile);
  xlsxUploadBtn.addEventListener('click', () => xlsxUploadInput.click());
  xlsxUploadInput.addEventListener('change', loadXLSXFile);
  decrementBtn.addEventListener('click', decrementPage);
  incrementBtn.addEventListener('click', incrementPage);



})();
