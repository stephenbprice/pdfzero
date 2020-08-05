const pdfz = (function () {



  // MISC HELPERS
  const loadFile = (f) => {
    return new Promise((resolve, reject) => {
      const filereader = new FileReader();
      filereader.onload = () => {
        const bytes = new Uint8Array(filereader.result);
        resolve(bytes);
      }
      filereader.onerror = (e) => {
        reject(e);
      }
      filereader.readAsArrayBuffer(f);
    });
  };



  // PDFJS HELPERS
  const parsePDFJSAnnotationId = (annotationId) => {
    let [objNum, genNum] = annotationId.split('R')
    if (genNum === '') {
      genNum = 0
    }
    return [parseInt(objNum, 10), parseInt(genNum, 10)]
  }

  const renderPDFPage = async (canvas, page, width=null) => {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, context.width, context.height);
    const cssUnits = 96 / 72;
    let viewport = page.getViewport(1);
    if (width) {
      const scale = width / (viewport.width * cssUnits);
      viewport = page.getViewport(scale);
    }
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render(renderContext);
    return viewport;
  };



  // PDFLIB HELPERS
  const getPDFLibObjById = (pdflib, objNum, genNum) => {
    return pdflib.context.lookup(PDFLib.PDFRef.of(objNum, genNum));
  }

  const addTextToPDF = async (pdflib, text, pageNum, percentX, percentY, font, fontSize) => {
    const embeddedFont = await pdflib.embedFont(font);
    const page = await pdflib.getPages()[pageNum-1]
    const { width, height } = page.getSize()
    const pdfX = width * percentX;
    const pdfY = height * percentY;
    await page.drawText(text, {
        x: pdfX,
        y: pdfY,
        size: fontSize,
        font: embeddedFont,
        color: PDFLib.rgb(0.0, 0.0, 0.0)
    });
  };

  const compressPDF = async (pdflib) => {
    const visited = new Map()
    const queue = []
    const trailer = pdflib.context.trailerInfo
    if ('Root' in trailer) queue.push(trailer.Root)
    if ('Info' in trailer) queue.push(trailer.Info)
    let key, val
    for ([key, val] of pdflib.catalog.dict.entries()) {
      queue.push(val)
    }
    const visit = (o) => {
      if (o instanceof PDFLib.PDFArray) {
        for (var obj of o.asArray()) {
          queue.push(obj)
        }
      } else if (o instanceof PDFLib.PDFBool) {
        return
      } else if (o instanceof PDFLib.PDFDict) {
        for ([key, val] of o.entries()) {
          queue.push(val)
        }
      } else if (o instanceof PDFLib.PDFHexString) {
        return
      } else if (o instanceof PDFLib.PDFInvalidObject) {
        return
      } else if (o instanceof PDFLib.PDFPageLeaf) {
        for ([key, val] of o.dict) {
          queue.push(val)
        }
      } else if (o instanceof PDFLib.PDFName) {
        return
      } else if (o instanceof PDFLib.PDFNumber) {
        return
      } else if (o instanceof PDFLib.PDFRawStream) {
        return
      } else if (o instanceof PDFLib.PDFRef) {
        if (o in visited) return
        visited[o] = true
        queue.push(pdflib.context.lookup(o))
      } else if (o instanceof PDFLib.PDFStream) {
        o.dict.forEach(val => queue.push(val))
        return
      } else if (o instanceof PDFLib.PDFString) {
        return
      } else {
        return
      }
    }
    while (true) {
      if (!queue.length) break
      const ref = queue.shift()
      visit(ref)
    }
    for ([key] of pdflib.context.indirectObjects.entries()) {
      if (!(key in visited)) {
        pdflib.context.delete(key)
      }
    }
  }

  const flattenAnnotation = async (pdflib, annotationRef) => {
    // STEP 1: Get then /AP > /N object stream
    if (!annotationRef) return
    const annotation = pdflib.context.lookup(annotationRef)

    // STEP 2: Find all the pages it appears on and process
    pdflib.getPages().forEach(page => {
      const pageAnnotsRef = page.node.get(PDFLib.PDFName.of('Annots'))
      if (!pageAnnotsRef) return
      const pageAnnots = pdflib.context.lookup(pageAnnotsRef)
      // Find matching annotations on page and delete
      const matchingAnnotationIDXs = []
      pageAnnots.asArray().forEach((pageAnnotRef, i) => {
        if (pageAnnotRef === annotationRef) {
          matchingAnnotationIDXs.push(i)
        }
      })
      if (!matchingAnnotationIDXs) return
      matchingAnnotationIDXs.reverse().forEach(idx => {
        pageAnnots.remove(idx)
      })
      if (pageAnnots.asArray().length === 0) {
        pdflib.context.delete(pageAnnotsRef)
        page.node.delete(PDFLib.PDFName.of('Annots'))
      }
      // Make sure the annnotation has a normal appearance
      const appearanceRef = annotation.get(PDFLib.PDFName.of('AP'))
      if (!appearanceRef) return
      const appearance = pdflib.context.lookup(appearanceRef)
      const normalAppearanceRef = appearance.get(PDFLib.PDFName.of('N'))
      if (!normalAppearanceRef) return
      const normalAppearance = pdflib.context.lookup(normalAppearanceRef);
      if (!(normalAppearance instanceof PDFLib.PDFStream)) return
      // Add xobject reference to page
      const xObjectName = PDFLib.PDFName.of(PDFLib.addRandomSuffix('asdf'));
      page.node.setXObject(xObjectName, normalAppearanceRef)
      // Draw xobject in page stream
      const rect = annotation.get(PDFLib.PDFName.of('Rect')).asArray();
      page.pushOperators(
        PDFLib.pushGraphicsState(),
        PDFLib.concatTransformationMatrix(1, 0, 0, 1, rect[0].asNumber(), rect[1].asNumber()),
        PDFLib.drawObject(xObjectName),
        PDFLib.popGraphicsState()
      );
    })
    //  STEP 3: Remove it from the acroforms list
    const acroformRef = pdflib.catalog.get(PDFLib.PDFName.of('AcroForm'))
    if (!acroformRef) return
    const acroform = pdflib.context.lookup(acroformRef)
    const acroformFieldRefs = acroform.get(PDFLib.PDFName.of('Fields'))
    const fieldRefsArray = acroformFieldRefs.asArray();
    for (let i = fieldRefsArray.length - 1; i >= 0; i--) {
      if (fieldRefsArray[i] === annotationRef) {
        acroformFieldRefs.remove(i)
      }
    }
  }

  const flattenPDF = async (pdflib) => {
    const acroForm = pdflib.context.lookup(pdflib.catalog.get(PDFLib.PDFName.of('AcroForm')));
    const acroFields = acroForm.get(PDFLib.PDFName.of('Fields'));
    acroFields.asArray().forEach(async (ref) => {
      await flattenAnnotation(pdflib, ref)
    })
    while (acroFields.asArray().length) {
      acroFields.remove(0)
    }
  }

  const updateTextAcroFieldValue = (pdflib, acroField, value) => {
    // Make sure it is a text field
    if (!acroField.get(PDFLib.PDFName.of('FT')) === PDFLib.PDFName.of('Tx')) return
    // Acrobat is gonna bitch if this is missing
    const acroform = pdflib.context.lookup(pdflib.catalog.get(PDFLib.PDFName.of('AcroForm')))
    acroform.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.False);
    // set the value
    acroField.set(PDFLib.PDFName.of('V'), PDFLib.PDFString.of(value));
    // I dream of appearance streams 
    const defaultAppearanceString = acroField.get(PDFLib.PDFName.of('DA')).asString()
    const rect = acroField.get(PDFLib.PDFName.of('Rect')).asArray();
    const width = Math.abs(rect[2].asNumber() - rect[0].asNumber());
    const height = Math.abs(rect[3].asNumber() - rect[1].asNumber());
    const dict = pdflib.context.obj({
      Type: 'XObject',
      Subtype: 'Form',
      FormType: 1,
      BBox: [0, 0, width, height]
    })
    const operators = [
      PDFLib.PDFOperator.of('BMC', [PDFLib.PDFName.of('Tx')]),
      PDFLib.pushGraphicsState(),
      PDFLib.rectangle(0, 0, width, height),
      PDFLib.clip(),
      PDFLib.endPath(),
      PDFLib.beginText(),
      PDFLib.PDFOperator.of(defaultAppearanceString),
      PDFLib.moveText(0, 0),
      PDFLib.showText(PDFLib.PDFString.of(value)),
      PDFLib.endText(),
      PDFLib.popGraphicsState(),
      PDFLib.PDFOperator.of('EMC')
    ]
    const streamRef = pdflib.context.register(PDFLib.PDFContentStream.of(dict, operators));
    let appearanceStreams = acroField.get(PDFLib.PDFName.of('AP'))
    if (!appearanceStreams) {
      appearanceStreams = new PDFLib.PDFDict(new Map(), pdflib.context)
      acroField.set(PDFLib.PDFName.of('AP'), appearanceStreams)
    }
    appearanceStreams.set(PDFLib.PDFName.of('N'), streamRef)
  }



  return {
    loadFile: loadFile,
    parsePDFJSAnnotationId: parsePDFJSAnnotationId,
    renderPDFPage: renderPDFPage,
    getPDFLibObjById: getPDFLibObjById,
    addTextToPDF: addTextToPDF,
    compressPDF: compressPDF,
    updateTextAcroFieldValue: updateTextAcroFieldValue,
    flattenPDF: flattenPDF,
  }



})();
