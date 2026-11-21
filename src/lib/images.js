export function compressImage(file, maxEdge = 1600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const source = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(source)
        if (!blob) {
          reject(new Error('Gambar tidak dapat diproses.'))
          return
        }
        const name = file.name.replace(/\.\w+$/, '') || 'gambar'
        resolve(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    image.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error('Gambar tidak dapat dibaca.'))
    }
    image.src = source
  })
}
