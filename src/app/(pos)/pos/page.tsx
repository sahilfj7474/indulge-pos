'use client'

import { useState, useEffect, useMemo } from 'react'
import { CartItem, Category, Customer, PaymentMethod, Product, Sale } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { getCategories, getActiveProducts, getProductByBarcode, searchProducts } from '@/lib/services/products.service'
import { completeSale, SplitPayment } from '@/lib/services/pos.service'
import { getHeldOrders, saveHeldOrder, HeldOrderRecord } from '@/lib/services/held-orders.service'
import { getSettings } from '@/lib/services/settings.service'
import { getActivePromotions, applyPromotions, Promotion } from '@/lib/services/promotions.service'
import { getVariants, ProductVariant } from '@/lib/services/variants.service'
import { calculateLoyaltyPoints } from '@/lib/utils'
import BarcodeInput from '@/components/pos/BarcodeInput'
import CategoryFilter from '@/components/pos/CategoryFilter'
import ProductGrid from '@/components/pos/ProductGrid'
import Cart, { computeTotals, DEFAULT_TAX_RATE } from '@/components/pos/Cart'
import PaymentModal from '@/components/pos/PaymentModal'
import Receipt from '@/components/pos/Receipt'
import HeldOrdersModal from '@/components/pos/HeldOrdersModal'
import VariantSelectModal from '@/components/pos/VariantSelectModal'
import { PauseCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function POSPage() {
  const { user } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Settings
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE)
  const [taxInclusive, setTaxInclusive] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})

  // Promotions
  const [promotions, setPromotions] = useState<Promotion[]>([])

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [surchargeAmount, setSurchargeAmount] = useState(0)

  // Variant selection
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])

  // Flow state
  const [showPayment, setShowPayment] = useState(false)
  const [showHeldOrders, setShowHeldOrders] = useState(false)
  const [heldOrders, setHeldOrders] = useState<HeldOrderRecord[]>([])
  const [completedSale, setCompletedSale] = useState<{
    sale: Sale; amountTendered: number; pointsEarned: number; splits?: SplitPayment[]
  } | null>(null)

  useEffect(() => {
    if (!user?.location_id) return
    Promise.all([
      getCategories(),
      getActiveProducts(user.location_id),
      getSettings(),
      getActivePromotions(),
    ]).then(([cats, prods, s, promos]) => {
      setCategories(cats)
      setProducts(prods)
      setSettings(s)
      const rate = parseFloat(s.tax_rate ?? '9') / 100
      setTaxRate(isNaN(rate) ? DEFAULT_TAX_RATE : rate)
      setTaxInclusive(s.tax_inclusive === 'true')
      setPromotions(promos)
      setLoadingProducts(false)
    })
    loadHeldOrders()
  }, [user?.location_id])

  async function loadHeldOrders() {
    if (!user?.location_id) return
    const orders = await getHeldOrders(user.location_id)
    setHeldOrders(orders)
  }

  // Search debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return }
    if (!user?.location_id) return
    const timer = setTimeout(async () => {
      const results = await searchProducts(searchQuery, user.location_id!)
      setSearchResults(results)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, user?.location_id])

  const displayProducts = useMemo(() => {
    const base = searchQuery.length >= 2 ? searchResults : products
    if (!selectedCategory) return base
    return base.filter(p => p.category_id === selectedCategory)
  }, [products, searchResults, searchQuery, selectedCategory])

  async function addToCart(product: Product) {
    // Check if product has variants — if so, show variant picker
    if ((product as any).has_variants) {
      const v = await getVariants(product.id)
      if (v.length > 0) {
        setVariants(v)
        setVariantProduct(product)
        return
      }
    }
    addProductToCart(product)
  }

  function addProductToCart(product: Product, variantName?: string, priceOverride?: number) {
    const unitPrice = priceOverride ?? product.price
    const displayName = variantName ? `${product.name} (${variantName})` : product.name
    setCartItems(prev => {
      const key = `${product.id}-${variantName ?? ''}`
      const existing = prev.findIndex(i => i.product.id === product.id && i.product.name === displayName)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 }
        return updated
      }
      return [...prev, {
        product: { ...product, name: displayName },
        quantity: 1,
        unit_price: unitPrice,
        discount_amount: 0,
        note: '',
      }]
    })
  }

  async function handleBarcodeScan(barcode: string) {
    const product = await getProductByBarcode(barcode)
    if (product) {
      addToCart(product)
      toast.success(`Added: ${product.name}`, { duration: 1500 })
    } else {
      setSearchQuery(barcode)
      toast.error('Product not found for this barcode')
    }
  }

  function handleBarcodeChange(value: string) {
    setBarcodeInput(value)
    setSearchQuery(value)
  }

  function updateQty(index: number, qty: number) {
    if (qty <= 0) { removeItem(index); return }
    setCartItems(prev => { const u = [...prev]; u[index] = { ...u[index], quantity: qty }; return u })
  }

  function removeItem(index: number) {
    setCartItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateNote(index: number, note: string) {
    setCartItems(prev => { const u = [...prev]; u[index] = { ...u[index], note }; return u })
  }

  function clearCart() {
    setCartItems([])
    setCustomer(null)
    setDiscountValue(0)
    setLoyaltyPointsToRedeem(0)
    setSurchargeAmount(0)
  }

  async function handleHold() {
    if (cartItems.length === 0) return
    const label = prompt('Label for this held order:', 'Table 1') ?? ''
    if (!label.trim()) return
    try {
      await saveHeldOrder(user!.location_id!, user!.id, label.trim(), {
        items: cartItems,
        customer,
        discountType,
        discountValue,
        loyaltyPointsToRedeem,
        surchargeAmount,
      })
      clearCart()
      toast.success(`Order held: ${label}`)
      loadHeldOrders()
    } catch {
      toast.error('Failed to hold order')
    }
  }

  function handleResume(order: HeldOrderRecord) {
    const d = order.data
    setCartItems(d.items)
    setCustomer(d.customer)
    setDiscountType(d.discountType)
    setDiscountValue(d.discountValue)
    setLoyaltyPointsToRedeem(d.loyaltyPointsToRedeem)
    setSurchargeAmount(d.surchargeAmount ?? 0)
    setHeldOrders(prev => prev.filter(o => o.id !== order.id))
    toast.success(`Resumed: ${order.label}`)
  }

  // Auto-apply promotions
  const subtotalRaw = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const { itemDiscounts: promoDiscounts, appliedPromo } = useMemo(
    () => applyPromotions(cartItems, promotions, subtotalRaw),
    [cartItems, promotions, subtotalRaw]
  )

  // Merge promo discounts into cart items (in-memory, not mutating state)
  const cartItemsWithPromo = useMemo(() =>
    cartItems.map((item, i) => ({ ...item, discount_amount: item.discount_amount + (promoDiscounts[i] ?? 0) })),
    [cartItems, promoDiscounts]
  )

  const { subtotal, discountAmount, loyaltyDiscount, taxAmount, total } = computeTotals(
    cartItemsWithPromo, discountType, discountValue, loyaltyPointsToRedeem, surchargeAmount, taxRate, taxInclusive
  )

  async function handleCompleteSale(method: PaymentMethod, amountTendered: number, splits?: SplitPayment[]) {
    if (!user) return
    if (method === 'account' && !customer) {
      toast.error('Select a customer to charge to account')
      return
    }
    setShowPayment(false)
    try {
      const sale = await completeSale({
        locationId: user.location_id!,
        userId: user.id,
        customerId: customer?.id ?? null,
        items: cartItemsWithPromo,
        subtotal,
        discountAmount: discountAmount + loyaltyDiscount,
        taxAmount,
        surchargeAmount,
        total,
        paymentMethod: method,
        splitPayments: splits,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        notes: '',
      })
      const pointsEarned = customer ? calculateLoyaltyPoints(total) : 0
      setCompletedSale({ sale, amountTendered, pointsEarned, splits })
    } catch (err) {
      toast.error('Failed to complete sale. Please try again.')
      console.error(err)
    }
  }

  function handleReceiptClose() {
    setCompletedSale(null)
    clearCart()
  }

  if (!user?.location_id) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400">No location assigned to your account.</p>
          <p className="text-gray-500 text-sm mt-1">Contact an admin to assign you to a location.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-0 -m-6">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col min-w-0 p-4 overflow-hidden">
        <div className="flex gap-2">
          <div className="flex-1">
            <BarcodeInput
              value={barcodeInput}
              onChange={handleBarcodeChange}
              onScan={handleBarcodeScan}
            />
          </div>
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeldOrders(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700/50 text-amber-400 text-xs font-medium rounded-lg transition-colors"
            >
              <PauseCircle size={14} />
              {heldOrders.length} Held
            </button>
          )}
        </div>

        <div className="mt-3 mb-3">
          <CategoryFilter categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingProducts ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Loading products...</div>
          ) : (
            <ProductGrid products={displayProducts} onAdd={addToCart} />
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 shrink-0 flex flex-col">
        <Cart
          items={cartItemsWithPromo}
          customer={customer}
          discountType={discountType}
          discountValue={discountValue}
          loyaltyPointsToRedeem={loyaltyPointsToRedeem}
          surchargeAmount={surchargeAmount}
          taxRate={taxRate}
          taxInclusive={taxInclusive}
          appliedPromoName={appliedPromo}
          onCustomerChange={c => { setCustomer(c); setLoyaltyPointsToRedeem(0) }}
          onQtyChange={updateQty}
          onRemove={removeItem}
          onNoteChange={updateNote}
          onDiscountTypeChange={setDiscountType}
          onDiscountValueChange={setDiscountValue}
          onLoyaltyRedeemChange={setLoyaltyPointsToRedeem}
          onSurchargeChange={setSurchargeAmount}
          onCharge={() => setShowPayment(true)}
          onClear={clearCart}
          onHold={handleHold}
        />
      </div>

      {/* Modals */}
      {showPayment && (
        <PaymentModal
          total={total}
          loyaltyPointsRedeemed={loyaltyPointsToRedeem}
          hasCustomer={!!customer}
          onConfirm={handleCompleteSale}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showHeldOrders && (
        <HeldOrdersModal
          orders={heldOrders}
          onResume={handleResume}
          onDeleted={id => setHeldOrders(prev => prev.filter(o => o.id !== id))}
          onClose={() => setShowHeldOrders(false)}
        />
      )}

      {variantProduct && (
        <VariantSelectModal
          product={variantProduct}
          variants={variants}
          onSelect={(v) => {
            addProductToCart(variantProduct, v.name, v.price_override ?? variantProduct.price)
            setVariantProduct(null)
          }}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {completedSale && user.location && (
        <Receipt
          sale={completedSale.sale}
          items={cartItemsWithPromo}
          customer={customer}
          location={user.location}
          cashier={user}
          amountTendered={completedSale.amountTendered}
          loyaltyPointsRedeemed={loyaltyPointsToRedeem}
          loyaltyPointsEarned={completedSale.pointsEarned}
          splitPayments={completedSale.splits}
          settings={settings}
          taxRate={taxRate}
          taxInclusive={taxInclusive}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  )
}
