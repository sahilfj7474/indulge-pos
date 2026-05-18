'use client'

import { useState, useRef, useEffect } from 'react'
import { Product, Category, Location } from '@/types'
import { createProduct, updateProduct, getLocations } from '@/lib/services/admin.service'
import { getStockByProduct, setStockLevel } from '@/lib/services/inventory.service'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import Modal from '@/components/ui/Modal'
import { ImagePlus } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  product?: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export default function ProductModal({ product, categories, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    category_id: product?.category_id ?? '',
    price: product?.price?.toString() ?? '',
    cost: product?.cost?.toString() ?? '',
    is_active: product?.is_active ?? true,
  })
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [locations, setLocations] = useState<Location[]>([])
  // Map of location_id -> quantity string (for the input)
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})
  // Original quantities for edit mode (to detect changes)
  const [originalStock, setOriginalStock] = useState<Record<string, number>>({})

  useEffect(() => {
    async function loadLocations() {
      const locs = await getLocations()
      const active = locs.filter(l => l.is_active !== false)
      setLocations(active)

      if (product) {
        const stockRows = await getStockByProduct(product.id)
        const inputs: Record<string, string> = {}
        const originals: Record<string, number> = {}
        for (const loc of active) {
          const row = stockRows.find(r => r.location_id === loc.id)
          inputs[loc.id] = (row?.quantity ?? 0).toString()
          originals[loc.id] = row?.quantity ?? 0
        }
        setStockInputs(inputs)
        setOriginalStock(originals)
      } else {
        const inputs: Record<string, string> = {}
        for (const loc of active) inputs[loc.id] = '0'
        setStockInputs(inputs)
      }
    }
    loadLocations()
  }, [product?.id])

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(productId: string): Promise<string | null> {
    if (!imageFile) return imageUrl
    const supabase = createClient()
    const ext = imageFile.name.split('.').pop()
    const path = `${productId}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true })
    if (error) { toast.error('Image upload failed'); return null }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error('Valid price is required'); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category_id: form.category_id || null,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : null,
        is_active: form.is_active,
        image_url: imageUrl,
      }

      if (product) {
        const uploadedUrl = await uploadImage(product.id)
        await updateProduct(product.id, { ...payload, image_url: uploadedUrl })

        // Apply stock level changes where quantity differs from original
        const userId = user?.id ?? ''
        await Promise.all(
          locations.map(async loc => {
            const newQty = parseInt(stockInputs[loc.id] ?? '0') || 0
            const oldQty = originalStock[loc.id] ?? 0
            if (newQty !== oldQty) {
              await setStockLevel(product.id, loc.id, userId, newQty, 'Manual stock set via product edit')
            }
          })
        )
        toast.success('Product updated')
      } else {
        const initialStock = locations.map(loc => ({
          location_id: loc.id,
          quantity: parseInt(stockInputs[loc.id] ?? '0') || 0,
        }))
        const created = await createProduct(payload, initialStock)
        if (imageFile && created) {
          const uploadedUrl = await uploadImage(created.id)
          if (uploadedUrl) await updateProduct(created.id, { image_url: uploadedUrl })
        }
        toast.success('Product created')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={product ? 'Edit Product' : 'Add Product'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Image upload */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Product Image</label>
          <div className="flex items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 bg-gray-800 border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={22} className="text-gray-500" />
              )}
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors">
                {imagePreview ? 'Change image' : 'Upload image'}
              </button>
              {imagePreview && (
                <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); setImageUrl(null) }}
                  className="ml-2 px-3 py-1.5 bg-gray-800 hover:bg-red-900/40 text-red-400 text-xs font-medium rounded-lg transition-colors">
                  Remove
                </button>
              )}
              <p className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP — max 2MB</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Product Name *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="e.g. Coca Cola 600ml" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">SKU</label>
            <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Barcode</label>
            <input type="text" value={form.barcode} onChange={e => set('barcode', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Scan or type" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Selling Price (FJD) *</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={e => set('price', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cost Price (FJD)</label>
            <input type="number" step="0.01" min="0" value={form.cost} onChange={e => set('cost', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Optional" />
          </div>
        </div>

        {/* Stock on Hand per location */}
        {locations.length > 0 && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Stock on Hand {product ? '(edit to set new level)' : '(opening stock)'}
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-300 truncate">{loc.name}</span>
                  <input
                    type="number"
                    min="0"
                    value={stockInputs[loc.id] ?? '0'}
                    onChange={e => setStockInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                    className="w-24 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-600 w-8">units</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <label htmlFor="is_active" className="text-sm text-gray-300">Active (visible on POS)</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving...' : product ? 'Update' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
