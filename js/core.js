const addClass = (el, class_) => {
  if (!el.classList.contains(class_))
    el.classList.add(class_);
}
const removeClass = (el, class_) => {
  if (el.classList.contains(class_))
    el.classList.remove(class_);
}
const hide = (el) => addClass(el, 'hidden')
const show = (el) => removeClass(el, 'hidden')

const loadFile = (f) => {
  return new Promise((resolve, reject) => {
    const filereader = new FileReader();
    filereader.onload = () => {
      const bytes = new Uint8Array(filereader.result);
      resolve(bytes);
    }
    filereader.onerror = () => {
      reject();
    }
  });
}

