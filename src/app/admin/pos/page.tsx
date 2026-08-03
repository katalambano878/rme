'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { listPriceFromProduct, listSkuRaw, listStockFromProduct } from '@/lib/product-metrics';

interface Product {
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
    image: string;
    sku: string;
}

interface CartItem extends Product {
    cartQuantity: number;
}

interface Customer {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    // Checkout State
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountTendered, setAmountTendered] = useState<string>('');
    const [processing, setProcessing] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<any>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'doorstep'>('pickup');
    const [guestDetails, setGuestDetails] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        region: ''
    });

    const ghanaRegions = [
        'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
        'Northern', 'Volta', 'Upper East', 'Upper West', 'Brong-Ahafo',
        'Ahafo', 'Bono', 'Bono East', 'North East', 'Savannah', 'Oti', 'Western North'
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const prodData = await api<any[]>('/api/catalog/products?status=active');
            if (prodData) {
                const formatted: Product[] = prodData.map((p: any) => {
                    const computedPrice = listPriceFromProduct(p);
                    const computedStock = listStockFromProduct(p);
                    const computedSku = listSkuRaw(p);
                    const sortedImages = [...(p.product_images || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                    return {
                        id: p.id,
                        name: p.name,
                        price: computedPrice,
                        quantity: computedStock,
                        category: p.categories?.name || 'Uncategorized',
                        image: sortedImages[0]?.url || null,
                        sku: computedSku,
                    };
                });
                setProducts(formatted);

                const cats = Array.from(new Set(formatted.map(p => p.category))).sort();
                setCategories(['All', ...cats]);
            }

            const staffRows = await api<any[]>('/api/admin/staff?includeCustomers=1');
            if (staffRows) setCustomers(staffRows.filter((c) => c.role === 'customer').slice(0, 200));

        } catch (error) {
            console.error('Error fetching POS data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Cart Functions
    const addToCart = (product: Product) => {
        if (product.quantity <= 0) return;
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, cartQuantity: item.cartQuantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, cartQuantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.cartQuantity + delta;
                return newQty > 0 ? { ...item, cartQuantity: newQty } : item;
            }
            return item;
        }));
    };

    const emptyCart = () => setCart([]);

    // Computed
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCat = activeCategory === 'All' || p.category === activeCategory;
            return matchesSearch && matchesCat;
        });
    }, [products, searchQuery, activeCategory]);

    // Filter customers by search
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customers;
        const q = customerSearch.toLowerCase();
        return customers.filter(c =>
            c.full_name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q)
        );
    }, [customers, customerSearch]);

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
    const tax = cartTotal * 0.0;
    const grandTotal = cartTotal + tax;
    const changeDue = amountTendered ? (parseFloat(amountTendered) - grandTotal) : 0;

    // Get the customer email and phone for the order
    const getOrderEmail = () => {
        if (selectedCustomer) return selectedCustomer.email;
        return guestDetails.email || 'pos-walkin@store.local';
    };

    const getOrderPhone = () => {
        if (selectedCustomer) return selectedCustomer.phone || '';
        return guestDetails.phone || '';
    };

    const getCustomerFullName = () => {
        if (selectedCustomer) return selectedCustomer.full_name || '';
        return `${guestDetails.firstName} ${guestDetails.lastName}`.trim();
    };

    // Validate before checkout
    const validateCheckout = (): string | null => {
        if (cart.length === 0) return 'Cart is empty';

        if (paymentMethod === 'momo') {
            const phone = getOrderPhone();
            if (!phone) return 'Phone number is required for Mobile Money payment';
        }

        if (paymentMethod === 'cash') {
            const tendered = parseFloat(amountTendered || '0');
            if (tendered < grandTotal) return 'Insufficient amount tendered';
        }

        // For guest, require at least a name or phone
        if (!selectedCustomer) {
            const hasName = guestDetails.firstName.trim() || guestDetails.lastName.trim();
            const hasContact = guestDetails.email.trim() || guestDetails.phone.trim();
            if (!hasName && !hasContact) return 'Please enter customer name or contact info';
        }

        // Require address for doorstep delivery
        if (deliveryMethod === 'doorstep') {
            if (!guestDetails.address.trim()) return 'Delivery address is required';
            if (!guestDetails.city.trim()) return 'City is required for delivery';
            if (!guestDetails.region) return 'Region is required for delivery';
        }

        return null;
    };

    // Checkout Logic
    const handleCheckout = async () => {
        const validationError = validateCheckout();
        if (validationError) {
            setCheckoutError(validationError);
            return;
        }

        setProcessing(true);
        setCheckoutError(null);

        try {
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const customerName = getCustomerFullName();
            const customerEmail = getOrderEmail();
            const customerPhone = getOrderPhone();

            // POS = customer is physically at the counter. Cash, card, AND MoMo
            // are all "paid in person" by the time the cashier clicks Complete
            // Sale (the cashier confirms the MoMo notification on their phone
            // before completing). So all three should write a paid payments row
            // and advance the order to `processing`. The old code only wrote a
            // payment row for cash/card and let MoMo go through Moolre's online
            // link flow, which never fired the webhook for in-store payments and
            // left the order looking unpaid forever.
            const isInPersonPayment = ['cash', 'card', 'momo'].includes(paymentMethod);

            // Build shipping/billing address
            const addressData = selectedCustomer ? {
                firstName: selectedCustomer.full_name?.split(' ')[0] || '',
                lastName: selectedCustomer.full_name?.split(' ').slice(1).join(' ') || '',
                email: selectedCustomer.email,
                phone: selectedCustomer.phone || '',
                address: guestDetails.address,
                city: guestDetails.city,
                region: guestDetails.region,
                pos_sale: true
            } : {
                firstName: guestDetails.firstName,
                lastName: guestDetails.lastName,
                email: guestDetails.email,
                phone: guestDetails.phone,
                address: guestDetails.address,
                city: guestDetails.city,
                region: guestDetails.region,
                pos_sale: true
            };

            const order = await api<any>('/api/admin/pos/checkout', {
                method: 'POST',
                json: {
                    orderNumber,
                    customerEmail,
                    customerPhone,
                    paymentMethod,
                    deliveryMethod,
                    cart,
                    addressData,
                    subtotal: cartTotal,
                    tax,
                    grandTotal,
                },
            });

            if (isInPersonPayment) {
                setCompletedOrder({ id: order.id, orderNumber, total: grandTotal, items: cart });
                setCart([]);

                if (customerEmail && customerEmail !== 'pos-walkin@store.local') {
                    fetch('/api/notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            type: 'order_created',
                            payload: {
                                ...order,
                                order_number: orderNumber,
                                email: customerEmail,
                                shipping_address: addressData,
                            },
                        }),
                    }).catch((err) => console.error('POS Notification error:', err));
                }
            } else {
                // Future: any non-in-person POS payment method (e.g. "send a
                // remote payment link") would be handled here. We deliberately
                // no longer route the standard MoMo button through Moolre's
                // online link API — at the counter the customer always pays
                // directly and the cashier confirms before completing the sale.
                throw new Error(`Unsupported POS payment method: ${paymentMethod}`);
            }

        } catch (error: any) {
            console.error('Checkout failed:', error);
            setCheckoutError(error.message || 'Checkout failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const resetCheckout = () => {
        setShowCheckoutModal(false);
        setCompletedOrder(null);
        setAmountTendered('');
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCheckoutError(null);
        setPaymentMethod('cash');
        setDeliveryMethod('pickup');
        setGuestDetails({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            region: ''
        });
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-90px)] -m-4 lg:-m-6 overflow-hidden bg-gray-100 relative">

            {/* LEFT: Product Grid */}
            <div className={`flex-1 flex flex-col h-full min-w-0 ${isMobileCartOpen ? 'hidden lg:flex' : 'flex'}`}>
                {/* Header / Search */}
                <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between space-x-4 shrink-0">
                    <div className="relative flex-1 max-w-lg">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat
                                    ? 'bg-rose-800 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid Area */}
                <div className="flex-1 overflow-y-auto p-4 content-start">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">Loading products...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <i className="ri-inbox-line text-4xl mb-2"></i>
                            <p>No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 pb-20 lg:pb-4">
                            {filteredProducts.map((product) => {
                                const inStock = product.quantity > 0;
                                return (
                                <div
                                    key={product.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => inStock && addToCart(product)}
                                    onKeyDown={(e) => {
                                        if (inStock && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            addToCart(product);
                                        }
                                    }}
                                    className={`group flex min-w-0 flex-col rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all h-full
                                        ${inStock ? 'cursor-pointer hover:shadow-md hover:border-rose-200/80' : 'cursor-not-allowed opacity-[0.58]'}`}
                                >
                                    <div className="relative aspect-[5/6] shrink-0 overflow-hidden rounded-t-2xl bg-gray-50">
                                        {product.image
                                            ? <img src={product.image} alt={product.name} className={`h-full w-full object-cover transition-transform duration-300 ${inStock ? 'group-hover:scale-[1.03]' : ''}`} />
                                            : <div className={`h-full w-full flex items-center justify-center text-gray-300 transition-transform duration-300 ${inStock ? 'group-hover:scale-[1.03]' : ''}`}><i className="ri-image-line text-4xl"></i></div>
                                        }
                                        {inStock ? (
                                            <div
                                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-white shadow-sm ring-2 ring-white/90"
                                                title={`Stock: ${product.quantity}`}
                                            >
                                                {product.quantity > 99 ? '99+' : product.quantity}
                                            </div>
                                        ) : (
                                            <div className="absolute right-2 top-2 rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 shadow-sm ring-2 ring-white/90">
                                                OUT
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5 sm:px-3.5 sm:pb-3.5 sm:pt-3">
                                        <h3 className={`mb-3 line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-snug text-gray-900 sm:text-sm ${!inStock ? 'text-gray-500' : ''}`}>
                                            {product.name}
                                        </h3>
                                        <div className="mt-auto flex items-end justify-between gap-2 border-t border-rose-100/80 pt-2.5">
                                            <span className={`min-w-0 flex-1 truncate text-sm font-bold tabular-nums sm:text-[15px] ${inStock ? 'text-rose-900' : 'text-gray-400'}`}>
                                                GH₵{product.price.toFixed(2)}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={!inStock}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addToCart(product);
                                                }}
                                                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2
                                                    ${inStock
                                                        ? 'bg-rose-50 text-rose-800 shadow-sm ring-1 ring-rose-200/90 hover:bg-rose-800 hover:text-white hover:ring-rose-800'
                                                        : 'cursor-not-allowed bg-gray-100 text-gray-300 ring-0'}`}
                                                aria-label={inStock ? 'Add to cart' : 'Out of stock'}
                                            >
                                                <i className="ri-add-line leading-none" aria-hidden />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Mobile Bottom Cart Bar */}
                {cart.length > 0 && (
                    <div className="lg:hidden p-4 border-t border-gray-200 bg-white fixed bottom-0 left-0 right-0 z-30 shadow-2xl safe-area-bottom">
                        <button
                            onClick={() => setIsMobileCartOpen(true)}
                            className="w-full py-3 bg-rose-800 text-white rounded-xl font-bold flex justify-between px-6 shadow-lg shadow-rose-900/10 active:scale-95 transition-transform"
                        >
                            <span className="flex items-center text-sm">
                                <span className="bg-white/20 px-2 py-0.5 rounded mr-2">{cart.reduce((a, b) => a + b.cartQuantity, 0)}</span>
                                Items
                            </span>
                            <span>View Cart</span>
                            <span>GH₵{grandTotal.toFixed(2)}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* RIGHT: Cart Panel */}
            <div className={`w-full lg:w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg z-20 absolute inset-0 lg:relative ${isMobileCartOpen ? 'flex' : 'hidden lg:flex'}`}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
                    <div className="flex items-center">
                        <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden mr-3 p-2 -ml-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                            <i className="ri-arrow-left-line text-xl"></i>
                        </button>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center">
                            <i className="ri-shopping-basket-2-line mr-2"></i>
                            Current Order
                        </h2>
                    </div>
                    <span className="bg-rose-100 text-rose-900 text-xs font-bold px-2 py-1 rounded-full">
                        {cart.reduce((a, b) => a + b.cartQuantity, 0)} Items
                    </span>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                            <i className="ri-shopping-cart-line text-5xl opacity-20"></i>
                            <p className="text-sm">Cart is empty</p>
                            <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden text-rose-700 font-medium hover:underline">
                                Start Adding Products
                            </button>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                                <div className="w-16 h-16 bg-white rounded-md overflow-hidden flex-shrink-0 border border-gray-200 flex items-center justify-center">
                                    {item.image
                                        ? <img src={item.image} className="w-full h-full object-cover" alt="" />
                                        : <i className="ri-image-line text-gray-300 text-2xl"></i>
                                    }
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500">
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center space-x-2 bg-white rounded border border-gray-200 px-1 py-0.5">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded">
                                                <i className="ri-subtract-line text-xs"></i>
                                            </button>
                                            <span className="text-sm font-semibold w-6 text-center">{item.cartQuantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded">
                                                <i className="ri-add-line text-xs"></i>
                                            </button>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">GH₵{(item.price * item.cartQuantity).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4 shrink-0 safe-area-bottom">
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>GH₵{cartTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Tax (0%)</span>
                            <span>GH₵0.00</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200 mt-2">
                            <span>Total</span>
                            <span>GH₵{grandTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={emptyCart}
                            disabled={cart.length === 0}
                            className="px-4 py-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => { setShowCheckoutModal(true); setCheckoutError(null); }}
                            disabled={cart.length === 0}
                            className="px-4 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Charge GH₵{grandTotal.toFixed(2)}
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckoutModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {completedOrder ? (
                            // SUCCESS STATE
                            <div className="p-8 text-center flex flex-col items-center justify-center space-y-6 overflow-y-auto">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${completedOrder.paymentPending ? 'bg-amber-100' : 'bg-rose-100'}`}>
                                    <i className={`text-5xl ${completedOrder.paymentPending ? 'ri-time-line text-amber-600' : 'ri-checkbox-circle-fill text-rose-600'}`}></i>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {completedOrder.paymentPending ? 'Payment Link Generated!' : 'Payment Successful!'}
                                    </h2>
                                    <p className="text-gray-500 mt-1">Order #{completedOrder.orderNumber}</p>

                                    {!completedOrder.paymentPending && paymentMethod === 'cash' && changeDue > 0 && (
                                        <div className="mt-3 bg-pink-50 border border-rose-200 rounded-lg p-3">
                                            <p className="text-sm text-rose-700">Change Due</p>
                                            <p className="text-2xl font-bold text-rose-900">GH₵{changeDue.toFixed(2)}</p>
                                        </div>
                                    )}

                                    {completedOrder.paymentPending && completedOrder.paymentUrl && (
                                        <div className="mt-4 space-y-3">
                                            <p className="text-sm text-gray-600">
                                                Customer can pay using this link:
                                            </p>
                                            <a
                                                href={completedOrder.paymentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors"
                                            >
                                                <i className="ri-external-link-line mr-2"></i>
                                                Open Payment Page
                                            </a>
                                            <div className="mt-2">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(completedOrder.paymentUrl);
                                                        alert('Payment link copied!');
                                                    }}
                                                    className="text-sm text-rose-700 hover:text-rose-900 font-medium underline"
                                                >
                                                    <i className="ri-file-copy-line mr-1"></i>
                                                    Copy Link
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 w-full mt-4">
                                    <button onClick={() => window.print()} className="py-3 px-4 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                                        <i className="ri-printer-line mr-2"></i>
                                        Print Receipt
                                    </button>
                                    <button onClick={resetCheckout} className="py-3 px-4 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors">
                                        New Order
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // CHECKOUT FORM
                            <>
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                    <h3 className="text-xl font-bold text-gray-900">Finalize Payment</h3>
                                    <button onClick={() => setShowCheckoutModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500">
                                        <i className="ri-close-line text-xl"></i>
                                    </button>
                                </div>

                                <div className="p-6 space-y-6 overflow-y-auto">
                                    {/* Error Display */}
                                    {checkoutError && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                                            <i className="ri-error-warning-line text-red-500 mt-0.5"></i>
                                            <p className="text-sm text-red-700">{checkoutError}</p>
                                        </div>
                                    )}

                                    {/* Total Display */}
                                    <div className="text-center py-4 bg-pink-50 rounded-xl border border-rose-100">
                                        <p className="text-sm text-rose-900 uppercase tracking-wide font-semibold">Amount to Pay</p>
                                        <p className="text-4xl font-extrabold text-rose-700 mt-1">GH₵{grandTotal.toFixed(2)}</p>
                                    </div>

                                    {/* Customer Select */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Customer</label>

                                        {/* Customer search input */}
                                        <div className="relative mb-2">
                                            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                            <input
                                                type="text"
                                                placeholder="Search customers by name, email, or phone..."
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none text-sm"
                                            />
                                        </div>

                                        <select
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none mb-2"
                                            onChange={(e) => {
                                                setSelectedCustomer(customers.find(c => c.id === e.target.value) || null);
                                            }}
                                            value={selectedCustomer?.id || ''}
                                        >
                                            <option value="">Walk-in Customer / New Guest</option>
                                            {filteredCustomers.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.full_name || 'No Name'} — {c.phone || c.email}
                                                </option>
                                            ))}
                                        </select>

                                        {selectedCustomer && (
                                            <div className="bg-pink-50 border border-rose-200 rounded-lg p-3 mb-2 flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{selectedCustomer.full_name}</p>
                                                    <p className="text-xs text-gray-600">{selectedCustomer.email} {selectedCustomer.phone && `| ${selectedCustomer.phone}`}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCustomer(null)}
                                                    className="text-gray-400 hover:text-red-500 text-sm"
                                                >
                                                    <i className="ri-close-line"></i>
                                                </button>
                                            </div>
                                        )}

                                        {!selectedCustomer && (
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2 space-y-3">
                                                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-2">
                                                    New Customer Details
                                                    <span className="text-xs font-normal text-gray-500 ml-2">(will be saved to customer list)</span>
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="First Name *"
                                                        value={guestDetails.firstName}
                                                        onChange={e => setGuestDetails({ ...guestDetails, firstName: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Last Name"
                                                        value={guestDetails.lastName}
                                                        onChange={e => setGuestDetails({ ...guestDetails, lastName: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="email"
                                                        placeholder="Email"
                                                        value={guestDetails.email}
                                                        onChange={e => setGuestDetails({ ...guestDetails, email: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm"
                                                    />
                                                    <input
                                                        type="tel"
                                                        placeholder={paymentMethod === 'momo' ? 'Phone (Required) *' : 'Phone'}
                                                        value={guestDetails.phone}
                                                        onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })}
                                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm ${paymentMethod === 'momo' && !guestDetails.phone ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                                                            }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Delivery Method */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Method</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setDeliveryMethod('pickup')}
                                                className={`p-3 rounded-lg border transition-all flex items-center space-x-3 ${deliveryMethod === 'pickup'
                                                    ? 'border-rose-400 bg-pink-50 ring-1 ring-rose-400'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <i className={`ri-store-2-line text-xl ${deliveryMethod === 'pickup' ? 'text-rose-700' : 'text-gray-400'}`}></i>
                                                <div className="text-left">
                                                    <p className={`text-sm font-semibold ${deliveryMethod === 'pickup' ? 'text-rose-900' : 'text-gray-700'}`}>Store Pickup</p>
                                                    <p className="text-xs text-gray-500">Customer picks up</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setDeliveryMethod('doorstep')}
                                                className={`p-3 rounded-lg border transition-all flex items-center space-x-3 ${deliveryMethod === 'doorstep'
                                                    ? 'border-rose-400 bg-pink-50 ring-1 ring-rose-400'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <i className={`ri-truck-line text-xl ${deliveryMethod === 'doorstep' ? 'text-rose-700' : 'text-gray-400'}`}></i>
                                                <div className="text-left">
                                                    <p className={`text-sm font-semibold ${deliveryMethod === 'doorstep' ? 'text-rose-900' : 'text-gray-700'}`}>Doorstep Delivery</p>
                                                    <p className="text-xs text-gray-500">Deliver to address</p>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Delivery Address (shown for doorstep delivery) */}
                                        {deliveryMethod === 'doorstep' && (
                                            <div className="mt-3 bg-pink-50 p-4 rounded-lg border border-rose-200 space-y-3">
                                                <h4 className="text-sm font-bold text-gray-900 flex items-center">
                                                    <i className="ri-map-pin-line mr-2 text-rose-600"></i>
                                                    Delivery Address
                                                </h4>
                                                <input
                                                    type="text"
                                                    placeholder="Street Address / Location *"
                                                    value={guestDetails.address}
                                                    onChange={e => setGuestDetails({ ...guestDetails, address: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm"
                                                />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="City / Town *"
                                                        value={guestDetails.city}
                                                        onChange={e => setGuestDetails({ ...guestDetails, city: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm"
                                                    />
                                                    <select
                                                        value={guestDetails.region}
                                                        onChange={e => setGuestDetails({ ...guestDetails, region: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm"
                                                    >
                                                        <option value="">Select Region *</option>
                                                        {ghanaRegions.map(r => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Method */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { key: 'cash', label: 'Cash', icon: 'ri-money-cny-circle-line' },
                                                { key: 'card', label: 'Card', icon: 'ri-bank-card-line' },
                                                { key: 'momo', label: 'MoMo', icon: 'ri-smartphone-line' }
                                            ].map(method => (
                                                <button
                                                    key={method.key}
                                                    onClick={() => setPaymentMethod(method.key)}
                                                    className={`py-3 rounded-lg font-medium border transition-all flex flex-col items-center space-y-1 ${paymentMethod === method.key
                                                        ? 'border-rose-400 bg-pink-50 text-rose-900 ring-1 ring-rose-400'
                                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                                        }`}
                                                >
                                                    <i className={`${method.icon} text-xl`}></i>
                                                    <span className="text-sm">{method.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cash Tendered */}
                                    {paymentMethod === 'cash' && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount Tendered</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">GH₵</span>
                                                <input
                                                    type="number"
                                                    value={amountTendered}
                                                    onChange={(e) => setAmountTendered(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none font-bold text-lg"
                                                    placeholder="0.00"
                                                    autoFocus
                                                />
                                            </div>
                                            {changeDue > 0 && (
                                                <p className="text-right text-rose-600 font-bold mt-2">Change: GH₵{changeDue.toFixed(2)}</p>
                                            )}
                                            {changeDue < 0 && amountTendered && (
                                                <p className="text-right text-red-500 font-medium mt-2">Insufficient amount</p>
                                            )}
                                            {/* Quick amount buttons */}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {[grandTotal, Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).map(amount => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setAmountTendered(amount.toString())}
                                                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                                                    >
                                                        GH₵{amount.toFixed(2)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* MoMo info */}
                                    {paymentMethod === 'momo' && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <div className="flex items-start space-x-2">
                                                <i className="ri-information-line text-amber-600 mt-0.5"></i>
                                                <div className="text-sm text-amber-800">
                                                    <p className="font-semibold">Mobile Money Payment</p>
                                                    <p className="mt-1">A Moolre payment link will be generated. The customer can pay via their phone, or you can open the link on your device.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Card info */}
                                    {paymentMethod === 'card' && (
                                        <div className="bg-pink-50 border border-rose-200 rounded-lg p-3">
                                            <div className="flex items-start space-x-2">
                                                <i className="ri-bank-card-line text-rose-600 mt-0.5"></i>
                                                <div className="text-sm text-rose-900">
                                                    <p className="font-semibold">Card Payment</p>
                                                    <p className="mt-1">Process the card payment on your POS terminal, then tap &quot;Complete Payment&quot; to confirm.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                                    <button
                                        onClick={handleCheckout}
                                        disabled={processing}
                                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                                    >
                                        {processing ? (
                                            <>
                                                <i className="ri-loader-4-line animate-spin"></i>
                                                <span>Processing...</span>
                                            </>
                                        ) : paymentMethod === 'momo' ? (
                                            <>
                                                <i className="ri-smartphone-line"></i>
                                                <span>Generate Payment Link</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="ri-secure-payment-line"></i>
                                                <span>Complete Payment</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
