'use client'

import { useState, useEffect, useMemo } from 'react'
import { CartItem, Category, Customer, PaymentMethod, Product, Sale } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { getCategories, getActiveProducts, getProductByBarcode, searchProducts } from '@/lib/services/products.service'
import { completeSale } from '@/lib/services/pos.service'
import { calculateLoyaltyPoints } from '@/lib/utils'
import BarcodeInput from '@/components/pos/BarcodeInput'
import CategoryFilter from '@/components/pos/CategoryFilter'
import ProductGrid from '@/components/pos/ProductGrid'
import Cart, { computeTotals } from '@/components/pos/Cart'
import PaymentModal from '@/components/pos/PaymentModal'
import Receipt from '@/components/pos/Receipt'
import toast from 'react-hot-toast'

export default function POSPage() {
  const { user } = useAuth()

  // Products
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)

  // Flow
  const [showPayment, setShowPayment] = useState(false)
  const [completedSale, setCompletedSale] = useState<{
    sale: Sale
    amountTendered: number
    pointsEarned: number
  } | null>(null)

  useEffect(() => {
    if (!user?.location_id) return
    Promise.all([getCategories(), getActiveProducts(user.location_id)]).then(([cats, prods]) => {
      setCategories(cats)
      setProducts(prods)
      setLoadingProducts(false)
    })
  }, [user?.location_id])

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

  function addToCart(product: Product) {
    setCartItems(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 }
        return updated
      }
      return [...prev, { product, quantity: 1, unit_price: product.price, discount_amount: 0 }]
    })
  }

  async function handleBarcodeScan(barcode: string) {
    // Check if it matches search query first
    const product = await getProductByBarcode(barcode)
    if (product) {
      addToCart(product)
      toast.success(`Added: ${product.name}`, { duration: 1500 })
    } else {
      // Fall back to search
      setSearchQuery(barcode)
      toast.error('Product not found for this barcode')
    }
  }

  function handleBarcodeChange(value: string) {
    setBarcodeInput(value)
    setSearchQuery(value)
  }

  function updateQty(index: number, qty: number) {
    if (qty <= 0) {
      removeItem(index)
      return
    }
    setCartItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], quantity: qty }
      return updated
    })
  }

  function removeItem(index: number) {
    setCartItems(prev => prev.filter((_, i) => i !== index))
  }

  function clearCart() {
    setCartItems([])
    setCustomer(null)
    setDiscountValue(0)
    setLoyaltyPointsToRedeem(0)
  }

  const { subtotal, discountAmount, loyaltyDiscount, taxAmount, total } = computeTotals(
    cartItems, discountType, discountValue, loyaltyPointsToRedeem
  )

  async function handleCompleteSale(method: PaymentMethod, amountTendered: number) {
    if (!user) return
    setShowPayment(false)

    try {
      const sale = await completeSale({
        locationId: user.location_id!,
        userId: user.id,
        customerId: customer?.id ?? null,
        items: cartItems,
        subtotal,
        discountAmount: discountAmount + loyaltyDiscount,
        taxAmount,
        total,
        paymentMethod: method,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        notes: '',
      })

      const pointsEarned = customer ? calculateLoyaltyPoints(total) : 0
      setCompletedSale({ sale, amountTendered, pointsEarned })
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
        {/* Search/Barcode */}
        <BarcodeInput
          value={barcodeInput}
          onChange={handleBarcodeChange}
          onScan={handleBarcodeScan}
        />

        {/* Category filter */}
        <div className="mt-3 mb-3">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {loadingProducts ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading products...
            </div>
          ) : (
            <ProductGrid products={displayProducts} onAdd={addToCart} />
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 shrink-0 flex flex-col">
        <Cart
          items={cartItems}
          customer={customer}
          discountType={discountType}
          discountValue={discountValue}
          loyaltyPointsToRedeem={loyaltyPointsToRedeem}
          onCustomerChange={c => { setCustomer(c); setLoyaltyPointsToRedeem(0) }}
          onQtyChange={updateQty}
          onRemove={removeItem}
          onDiscountTypeChange={setDiscountType}
          onDiscountValueChange={setDiscountValue}
          onLoyaltyRedeemChange={setLoyaltyPointsToRedeem}
          onCharge={() => setShowPayment(true)}
          onClear={clearCart}
        />
      </div>

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          total={total}
          loyaltyPointsRedeemed={loyaltyPointsToRedeem}
          onConfirm={handleCompleteSale}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* Receipt modal */}
      {completedSale && user.location && (
        <Receipt
          sale={completedSale.sale}
          items={cartItems}
          customer={customer}
          location={user.location}
          cashier={user}
          amountTendered={completedSale.amountTendered}
          loyaltyPointsRedeemed={loyaltyPointsToRedeem}
          loyaltyPointsEarned={completedSale.pointsEarned}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  )
}
