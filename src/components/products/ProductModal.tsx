'use client'

import { useState, useRef, useEffect } from 'react'
import { Product, Category, Location } from '@/types'
import { createProduct, updateProduct, getLocations } from '@/lib/services/admin.service'
import { getStockByProduct, setStockLevel } from '@/lib/services/inventory.service'
import { getVariants, createVariant, updateVariant, deleteVariant, ProductVariant } from '@/lib/services/variants.service'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import Modal from '@/components/ui/Modal'
import { ImagePlus, Plus, Trash2, Package2 } from 'lucide-react'
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
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})
  const [originalStock, setOriginalStock] = useState<Record<string, number>>({})

  // Variants
  const [hasVariants, setHasVariants] = useState((product as any)?.has_variants ?? false)
  const [variants, setVariants] = useState<(ProductVariant | { _new: true; name: string; price_override: string })[]>([])

  useEffect(() => {
    async function loadData() {
      const [locs, existingVariants] = await Promise.all([
        getLocations(),
        product ? getVariants(product.id) : Promise.resolve([]),
      ])
      const active = locs.filter(l => l.is_active !== false)
      setLocations(active)
      setVariants(existingVariants)

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
    loadData()
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
        await updateProduct(product.id, { ...payload, image_url: uploadedUrl, has_variants: hasVariants } as any)

        // Apply stock level changes
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

        // Save new variants
        if (hasVariants) {
          for (const v of variants) {
            if ('_new' in v) {
              if (v.name.trim()) {
                await createVariant({
                  parent_product_id: product.id,
                  name: v.name.trim(),
                  sku: null,
                  barcode: null,
                  price_override: v.price_override ? parseFloat(v.price_override) : null,
                  is_active: true,
                  sort_order: 0,
                })
              }
            }
          }
        }

        toast.success('Product updated')
      } else {
        const initialStock = locations.map(loc => ({
          location_id: loc.id,
          quantity: parseInt(stockInputs[loc.id] ?? '0') || 0,
        }))
        const created = await createProduct({ ...payload, has_variants: hasVariants } as any, initialStock)
        if (imageFile && created) {
          const uploadedUrl = await uploadImage(created.id)
          if (uploadedUrl) await updateProduct(created.id, { image_url: uploadedUrl })
        }
        // Save variants for new product
        if (hasVariants) {
          for (const v of variants) {
            if ('_new' in v && v.name.trim()) {
              await createVariant({
                parent_product_id: created.id,
                name: v.name.trim(),
                sku: null,
                barcode: null,
                price_override: v.price_override ? parseFloat(v.price_override) : null,
                is_active: true,
                sort_order: 0,
              })
            }
          }
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
          <label className="block text-sm text-slate-500 mb-1">Product Image</label>
          <div className="flex items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 bg-blue-50 border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={22} className="text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-slate-600 text-xs font-medium rounded-lg transition-colors">
                {imagePreview ? 'Change image' : 'Upload image'}
              </button>
              {imagePreview && (
                <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); setImageUrl(null) }}
                  className="ml-2 px-3 py-1.5 bg-blue-50 hover:bg-red-900/40 text-red-400 text-xs font-medium rounded-lg transition-colors">
                  Remove
                </button>
              )}
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP — max 2MB</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Product Name *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="e.g. Coca Cola 600ml" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">SKU</label>
            <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)}
              className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Barcode</label>
            <input type="text" value={form.barcode} onChange={e => set('barcode', e.target.value)}
              className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Scan or type" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Category</label>
          <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
            className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Selling Price (FJD) *</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={e => set('price', e.target.value)}
              className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Cost Price (FJD)</label>
            <input type="number" step="0.01" min="0" value={form.cost} onChange={e => set('cost', e.target.value)}
              className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Optional" />
          </div>
        </div>

        {/* Stock on Hand per location */}
        {locations.length > 0 && (
          <div>
            <label className="block text-sm text-slate-500 mb-2">
              Stock on Hand {product ? '(edit to set new level)' : '(opening stock)'}
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-slate-600 truncate">{loc.name}</span>
                  <input
                    type="number"
                    min="0"
                    value={stockInputs[loc.id] ?? '0'}
                    onChange={e => setStockInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                    className="w-24 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400 w-8">units</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variants */}
        <div className="border-t border-blue-200 pt-4">
          <div className="flex items-center gap-3 mb-2">
            <input type="checkbox" id="has_variants" checked={hasVariants}
              onChange={e => setHasVariants(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            <label htmlFor="has_variants" className="text-sm text-slate-600 flex items-center gap-1.5">
              <Package2 size={14} /> This product has variants (e.g. sizes, colours)
            </label>
          </div>

          {hasVariants && (
            <div className="space-y-2 mt-3">
              <p className="text-xs text-slate-400">Leave price blank to use the base price above.</p>
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  {'_new' in v ? (
                    <>
                      <input type="text" placeholder="Variant name (e.g. Small)"
                        value={v.name} onChange={e => {
                          const next = [...variants]
                          ;(next[i] as any).name = e.target.value
                          setVariants(next)
                        }}
                        className="flex-1 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="number" step="0.01" min="0" placeholder="Price"
                        value={v.price_override} onChange={e => {
                          const next = [...variants]
                          ;(next[i] as any).price_override = e.target.value
                          setVariants(next)
                        }}
                        className="w-20 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-600">{(v as ProductVariant).name}</span>
                      <span className="text-xs text-slate-400 w-20 text-right">
                        {(v as ProductVariant).price_override ? `$${(v as ProductVariant).price_override}` : 'Base price'}
                      </span>
                      <button type="button"
                        onClick={async () => {
                          await deleteVariant((v as ProductVariant).id)
                          setVariants(variants.filter((_, j) => j !== i))
                        }}
                        className="text-slate-400 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button type="button"
                onClick={() => setVariants([...variants, { _new: true, name: '', price_override: '' }])}
                className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 mt-1">
                <Plus size={12} /> Add variant
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <label htmlFor="is_active" className="text-sm text-slate-600">Active (visible on POS)</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-slate-600 text-sm font-medium rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving...' : product ? 'Update' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}