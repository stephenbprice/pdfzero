const loader = {
  _loading: true,
  get loader () { return document.getElementById('loader') },
  get loading () { return this._loading },
  set loading (loading) {
    if (loading === this._loading) return
    if (this._loading) {
      hide(this.loader);
    } else {
      show(this.loader);
    }
    this._loading = !this._loading
  },
}

document.addEventListener('DOMContentLoaded', () => {
  loader.loading = false;
})
