import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Home, Camera, Refrigerator, Plus, X } from "lucide-react";
import BarcodeScanner, { type ScannedProduct } from "@/components/BarcodeScanner";

interface Ingredient {
  id: string;
  name: string;
  expirationDate: string;
  expirationColor: "red" | "green";
}

export default function HomePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savedIngredients, setSavedIngredients] = useState(0);

  const [currentPage, setCurrentPage] = useState<"home" | "fridge" | "scanner">("home");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    expirationDate: "",
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState({ firstName: "", lastName: "" });
  const [showWelcome, setShowWelcome] = useState(false);
  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastName, setTempLastName] = useState("");
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installPage, setInstallPage] = useState(0);
  const [installTouchStartX, setInstallTouchStartX] = useState(0);
  const [installTouchCurrentX, setInstallTouchCurrentX] = useState(0);
  const [isInstallDragging, setIsInstallDragging] = useState(false);

  // Carica il profilo utente dal localStorage al mount
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem("umai_profile");
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      } else {
        setShowWelcome(true);
      }
    } catch (error) {
      console.error("Errore nel caricamento del profilo dal localStorage:", error);
      setShowWelcome(true);
    }
  }, []);

  // Carica il contatore di ingredienti salvati dal localStorage e resetta se è il primo del mese
  useEffect(() => {
    try {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const savedData = localStorage.getItem("umai_saved_ingredients");
      if (savedData) {
        const { count, lastResetMonth, lastResetYear } = JSON.parse(savedData);
        
        // Resetta il contatore se è un nuovo mese
        if (lastResetMonth !== currentMonth || lastResetYear !== currentYear) {
          setSavedIngredients(0);
          localStorage.setItem("umai_saved_ingredients", JSON.stringify({
            count: 0,
            lastResetMonth: currentMonth,
            lastResetYear: currentYear
          }));
        } else {
          setSavedIngredients(count);
        }
      } else {
        // Prima volta, inizializza il contatore
        localStorage.setItem("umai_saved_ingredients", JSON.stringify({
          count: 0,
          lastResetMonth: currentMonth,
          lastResetYear: currentYear
        }));
      }
    } catch (error) {
      console.error("Errore nel caricamento del contatore dal localStorage:", error);
    }
  }, []);

  // Verifica se l'app è installata e mostra il popup di installazione
  useEffect(() => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const installPromptShown = localStorage.getItem('umai_install_prompt_shown');
    
    if (!isInstalled && !installPromptShown) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
        localStorage.setItem('umai_install_prompt_shown', 'true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Funzione per salvare il profilo
  const handleSaveProfile = () => {
    if (tempFirstName.trim() && tempLastName.trim()) {
      const profile = { firstName: tempFirstName.trim(), lastName: tempLastName.trim() };
      setUserProfile(profile);
      localStorage.setItem("umai_profile", JSON.stringify(profile));
      setShowWelcome(false);
      setTempFirstName("");
      setTempLastName("");
    }
  };

  // Funzione per ottenere il saluto in base all'ora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 18) return "Good afternoon!";
    return "Good evening!";
  };

  // Carica gli ingredienti dal localStorage al mount
  useEffect(() => {
    try {
      const savedIngredientsData = localStorage.getItem("umai_ingredients");
      if (savedIngredientsData) {
        setIngredients(JSON.parse(savedIngredientsData));
      }
    } catch (error) {
      console.error("Errore nel caricamento degli ingredienti dal localStorage:", error);
    }
  }, []);

  // Salva gli ingredienti nel localStorage quando cambiano
  useEffect(() => {
    try {
      localStorage.setItem("umai_ingredients", JSON.stringify(ingredients));
    } catch (error) {
      console.error("Errore nel salvataggio degli ingredienti nel localStorage:", error);
    }
  }, [ingredients]);

  const ingredientsCount = ingredients.length;
  
  // Calcola dinamicamente il colore per ogni ingrediente
  const getIngredientColor = (dateStr: string): "red" | "green" => {
    const [day, month, year] = dateStr.split("/").map(Number);
    const expirationDateObj = new Date(year, month - 1, day);
    const today = new Date();
    const daysUntilExpiration = Math.floor((expirationDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 5 ? "red" : "green";
  };
  
  // Filtra gli ingredienti in scadenza in base al colore calcolato dinamicamente
  const expiringCount = ingredients.filter((i) => getIngredientColor(i.expirationDate) === "red").length;

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Funzione per calcolare il colore della scadenza in base ai giorni rimasti
  const getExpirationColor = (dateStr: string): "red" | "green" => {
    const [day, month, year] = dateStr.split("/").map(Number);
    const expirationDateObj = new Date(year, month - 1, day);
    const today = new Date();
    const daysUntilExpiration = Math.floor((expirationDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 5 ? "red" : "green";
  };

  const formatDateDisplay = (dateStr: string) => {
    const [day, month, year] = dateStr.split("/").map(Number);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${day}/${monthNames[month - 1]}/${year}`;
  };

  const handleDateSelect = (day: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const dateStr = `${day}/${String(currentMonth.getMonth() + 1).padStart(2, "0")}/${currentMonth.getFullYear()}`;
    setNewIngredient({ ...newIngredient, expirationDate: dateStr });
    setShowDatePicker(false);
  };

  const handleAddIngredient = () => {
    if (newIngredient.name.trim() && newIngredient.expirationDate) {
      const [day, month, year] = newIngredient.expirationDate.split("/").map(Number);
      const expirationDateObj = new Date(year, month - 1, day);
      const today = new Date();
      const daysUntilExpiration = Math.floor((expirationDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      setIngredients([
        ...ingredients,
        {
          id: Date.now().toString(),
          name: newIngredient.name,
          expirationDate: newIngredient.expirationDate,
          expirationColor: daysUntilExpiration <= 5 ? "red" : "green",
        },
      ]);

      setNewIngredient({ name: "", expirationDate: "" });
      setShowDatePicker(false);
      setShowAddModal(false);
      setCurrentMonth(new Date());
    }
  };

  // Touch handlers per il popup di installazione
  const handleInstallTouchStart = (e: React.TouchEvent) => {
    setInstallTouchStartX(e.touches[0].clientX);
    setIsInstallDragging(true);
  };

  const handleInstallTouchMove = (e: React.TouchEvent) => {
    if (!isInstallDragging) return;
    setInstallTouchCurrentX(e.touches[0].clientX);
  };

  const handleInstallTouchEnd = (e: React.TouchEvent) => {
    setIsInstallDragging(false);
    const endX = e.changedTouches[0].clientX;
    const diff = installTouchStartX - endX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && installPage < 1) {
        setInstallPage(installPage + 1);
      } else if (diff < 0 && installPage > 0) {
        setInstallPage(installPage - 1);
      }
    }
    setInstallTouchCurrentX(0);
  };

  const handleRemoveIngredient = (id: string) => {
    const removedIngredient = ingredients.find((i) => i.id === id);
    setIngredients(ingredients.filter((i) => i.id !== id));
    
    // Aumenta il contatore solo se l'ingrediente era in scadenza imminente (rosso)
    if (removedIngredient?.expirationColor === "red") {
      const newCount = savedIngredients + 1;
      setSavedIngredients(newCount);
      
      // Salva il contatore aggiornato nel localStorage
      try {
        const today = new Date();
        localStorage.setItem("umai_saved_ingredients", JSON.stringify({
          count: newCount,
          lastResetMonth: today.getMonth(),
          lastResetYear: today.getFullYear()
        }));
      } catch (error) {
        console.error("Errore nel salvataggio del contatore nel localStorage:", error);
      }
    }
    
    // Notifiche disattivate
  };

  const handleProductScanned = (product: ScannedProduct) => {
    setCurrentPage("home");
    const firstLabel = product.items?.[0]?.label ?? "";
    setNewIngredient({
      name: firstLabel,
      expirationDate: "",
    });
    setShowAddModal(true);
  };

  // Se la welcome screen è aperta, mostrala
  if (showWelcome) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          <h1 className="text-3xl font-bold">Welcome in umai,</h1>
          <p className="text-lg text-muted-foreground">let us know you!</p>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="First name"
              value={tempFirstName}
              onChange={(e) => setTempFirstName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Last name"
              value={tempLastName}
              onChange={(e) => setTempLastName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <Button
            onClick={handleSaveProfile}
            disabled={!tempFirstName.trim() || !tempLastName.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
            {userProfile.firstName.charAt(0)}{userProfile.lastName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{getGreeting()}</p>
            <p className="text-base font-bold text-foreground truncate">{userProfile.firstName} {userProfile.lastName}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
        >
          <Bell size={20} className="text-foreground" />
        </button>
      </header>

      {/* Notifications Popup */}
      {showNotifications && (
        <div className="fixed top-16 right-2 left-2 max-w-sm mx-auto bg-card border border-border rounded-2xl p-4 shadow-lg z-50">
          <h3 className="text-white font-bold mb-4">Notifications</h3>
          {notifications.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="flex items-start gap-2 p-2 bg-secondary rounded-lg">
                  <span className="text-green-500 text-lg">✓</span>
                  <div className="flex-1">
                    <p className="text-foreground text-sm">{notif.message}</p>
                    <p className="text-muted-foreground text-xs">{notif.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barcode Scanner Overlay */}
      {currentPage === "scanner" && (
        <BarcodeScanner
          onScanned={handleProductScanned}
          onClose={() => setCurrentPage("home")}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-3 py-4">
        {currentPage === "home" ? (
          <div className="space-y-6">
            {/* Saved Ingredients Card */}
            <div className="bg-primary rounded-3xl p-5 text-white">
              <p className="text-xs font-light opacity-90">This month you saved</p>
              <p className="text-4xl font-bold">{savedIngredients} Ingredients!</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-center">
                <p className="text-3xl font-bold text-primary">{expiringCount}</p>
                <p className="text-xs text-muted-foreground">Ingredients close to expiration</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-primary rounded-2xl p-6 text-white hover:bg-opacity-90 transition-all active:scale-95 flex items-center justify-center"
              >
                <Plus size={40} className="font-bold" />
              </button>
            </div>

            {/* Expiring Soon Section */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">Expiring soon</h2>
              {ingredients.filter((i) => getIngredientColor(i.expirationDate) === "red").length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <div className="flex justify-center mb-3">
                    <img
                      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663600977674/imwpKD3Zwm7KdU6RGncD72/checkmark-icon-jGXppPCdKUas5tASZMWSat.webp"
                      alt="checkmark"
                      className="w-12 h-12"
                    />
                  </div>
                  <p className="text-foreground font-semibold text-sm">No ingredients expiring soon</p>
                  <p className="text-muted-foreground text-xs mt-1">Tap + to add ingredients to your fridge</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ingredients
                    .filter((i) => getIngredientColor(i.expirationDate) === "red")
                    .map((ingredient) => (
                      <div
                        key={ingredient.id}
                        className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-white font-semibold text-sm truncate">{ingredient.name}</span>
                        </div>
                        <span className="bg-primary text-white px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2">
                          {ingredient.expirationDate}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Fridge View */}
            {ingredients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-4">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663600977674/imwpKD3Zwm7KdU6RGncD72/fridge-icon-2b5m22AEKaHEdjmHofJXuR.webp"
                    alt="fridge"
                    className="w-20 h-20 opacity-60"
                  />
                </div>
                <div className="mb-4">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663600977674/imwpKD3Zwm7KdU6RGncD72/ice-cube-icon-ht63esyMqyxYqNQvyebF7M.webp"
                    alt="ice"
                    className="w-16 h-16"
                  />
                </div>
                <p className="text-lg font-semibold text-foreground mb-1">Your fridge is empty</p>
                <p className="text-muted-foreground text-xs">Use Scanner or tap + to add ingredients</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-foreground">Your Fridge</h2>
                  <span className="text-primary text-xs font-semibold">{ingredients.length} items</span>
                </div>
                {ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-white font-semibold text-sm truncate">{ingredient.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          getExpirationColor(ingredient.expirationDate) === "red"
                            ? "bg-primary text-white"
                            : "bg-green-500 bg-opacity-20 text-white"
                        }`}
                      >
                        {ingredient.expirationDate}
                      </span>
                      <button
                        onClick={() => handleRemoveIngredient(ingredient.id)}
                        className="p-1 hover:bg-secondary rounded transition-colors"
                      >
                        <X size={18} className="text-primary" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="w-full bg-primary text-white font-bold py-3 rounded-2xl hover:bg-opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={20} />
              Add ingredient manually
            </button>
          </div>
        )}
      </main>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card border border-border rounded-2xl p-3 max-w-xs w-full z-[101] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="text-primary font-bold text-lg hover:opacity-80 transition-opacity pointer-events-auto"
              >
                ←
              </button>
              <h3 className="text-white font-bold text-lg">
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="text-primary font-bold text-lg hover:opacity-80 transition-opacity pointer-events-auto"
              >
                →
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-muted-foreground text-xs font-semibold py-1">
                  {day}
                </div>
              ))}
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map(
                (_, i) => (
                  <div key={`empty-${i}`} />
                )
              )}
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
                const day = i + 1;
                const isSelected = newIngredient.expirationDate === `${day}/${String(currentMonth.getMonth() + 1).padStart(2, "0")}/${currentMonth.getFullYear()}`;
                return (
                  <button
                    key={day}
                    onClick={(e) => handleDateSelect(day, e)}
                    className={`py-2 rounded text-sm font-semibold transition-all pointer-events-auto cursor-pointer ${
                      isSelected
                        ? "bg-primary text-white"
                        : "bg-secondary text-foreground hover:bg-opacity-80"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => !showDatePicker && setShowAddModal(open)}>
        <DialogContent className="bg-card border border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl font-bold">Add ingredient</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">

            {/* Name Input */}
            <div>
              <p className="text-muted-foreground text-xs font-semibold mb-1">NAME</p>
              <input
                type="text"
                placeholder="e.g. Mozzarella"
                value={newIngredient.name}
                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                className="w-full bg-secondary text-foreground px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {/* Expiration Date Selection */}
            <div>
              <p className="text-muted-foreground text-xs font-semibold mb-2">EXPIRATION</p>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-full bg-secondary text-white font-semibold py-2 px-3 rounded-lg hover:bg-opacity-80 transition-all text-sm"
              >
                {newIngredient.expirationDate ? formatDateDisplay(newIngredient.expirationDate) : "Add a expiration date"}
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddIngredient}
              disabled={!newIngredient.name.trim() || !newIngredient.expirationDate}
              className="w-full bg-secondary text-foreground font-bold py-3 rounded-xl hover:bg-opacity-80 transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Fridge →
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-3 py-2 flex items-center justify-around">
        <button
          onClick={() => setCurrentPage("home")}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors ${
            currentPage === "home" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Home size={20} />
          <span className="text-xs font-semibold">Home</span>
        </button>

        <button
          onClick={() => setCurrentPage("scanner")}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors ${
            currentPage === "scanner" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center">
            <Camera size={20} />
          </div>
          <span className="text-xs font-semibold">Scanner</span>
        </button>

        <button
          onClick={() => setCurrentPage("fridge")}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors ${
            currentPage === "fridge" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Refrigerator size={20} />
          <span className="text-xs font-semibold">Fridge</span>
        </button>
      </nav>

      {/* Install Prompt Popup */}
      {showInstallPrompt && (
        <div className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">{installPage === 0 ? "iOS" : "Android"}</h3>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <div
            className="overflow-hidden"
            onTouchStart={handleInstallTouchStart}
            onTouchMove={handleInstallTouchMove}
            onTouchEnd={handleInstallTouchEnd}
          >
            <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${installPage * 100}%)` }}>
              {/* iOS Instructions */}
              <div className="w-full flex-shrink-0 p-4 space-y-3">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">1.</span> Open the link in Safari
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">2.</span> Tap the share button (three dots)
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">3.</span> Scroll down and tap "Add to Home Screen"
                </p>
              </div>
              
              {/* Android Instructions */}
              <div className="w-full flex-shrink-0 p-4 space-y-3">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">1.</span> Open the link in Chrome
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">2.</span> Tap the three dots menu
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">3.</span> Tap "Add to Home Screen"
                </p>
              </div>
            </div>
          </div>
          
          {/* Indicators */}
          <div className="flex justify-center gap-2 p-3 border-t border-border">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                installPage === 0 ? "bg-primary" : "bg-muted-foreground"
              }`}
            />
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                installPage === 1 ? "bg-primary" : "bg-muted-foreground"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
