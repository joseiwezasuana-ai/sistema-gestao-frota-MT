import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Calendar, 
  Plus, 
  Search, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Truck,
  Box,
  Layers,
  DollarSign,
  TrendingUp,
  Trash2,
  Filter,
  QrCode,
  Camera,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Utilitários locais
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

// SDK Oficial do Firestore
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  writeBatch, 
  serverTimestamp, 
  getDocs 
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import QrScannerModal from './QrScannerModal';

export default function MaintenanceRegistry({ user }: { user?: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [masterVehicles, setMasterVehicles] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filter, setFilter] = useState(currentMonth);

  const [searchTerm, setSearchTerm] = useState('');

  const [isQrReaderOpen, setIsQrReaderOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<'search' | 'vehicle' | 'material'>('search');

  const handleQrScanSuccess = (decodedText: string) => {
    setIsQrReaderOpen(false);
    const cleanedText = decodedText.trim();
    if (qrTarget === 'search') {
      setSearchTerm(cleanedText);
    } else if (qrTarget === 'vehicle') {
      const foundVehicle = masterVehicles.find(v => 
        v.id.toLowerCase() === cleanedText.toLowerCase() || 
        v.prefix.toLowerCase() === cleanedText.toLowerCase() ||
        v.name.toLowerCase().includes(cleanedText.toLowerCase())
      ) || vehicles.find(v => 
        v.id.toLowerCase() === cleanedText.toLowerCase() || 
        v.prefix.toLowerCase() === cleanedText.toLowerCase() ||
        v.name.toLowerCase().includes(cleanedText.toLowerCase())
      );
      if (foundVehicle) {
        setFormData(prev => ({ 
          ...prev, 
          vehicleId: foundVehicle.id,
          prefix: foundVehicle.prefix || '' 
        }));
      } else {
        alert(`Viatura "${cleanedText}" não encontrada.`);
      }
    } else if (qrTarget === 'material') {
      const foundItem = inventory.find(i => 
        i.id.toLowerCase() === cleanedText.toLowerCase() || 
        i.id.toLowerCase().endsWith(cleanedText.toLowerCase()) ||
        i.name.toLowerCase().includes(cleanedText.toLowerCase())
      );
      if (foundItem) {
        if (foundItem.stock <= 0) {
          alert(`O item "${foundItem.name}" está esgotado no armazém.`);
        } else {
          setSelectedMaterial(foundItem.id);
        }
      } else {
        alert(`Material "${cleanedText}" não encontrado no armazém.`);
      }
    }
  };


  // Gemini Maintenance Prediction
  const [selectedAnalysisVehicle, setSelectedAnalysisVehicle] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runMaintenanceAnalysis = async () => {
    if (!selectedAnalysisVehicle) return;
    setIsAnalyzing(true);
    setAnalysisResult('');
    
    const selectedVehicle = masterVehicles.find(v => v.id === selectedAnalysisVehicle) || vehicles.find(v => v.id === selectedAnalysisVehicle);
    const prefix = selectedVehicle?.prefix || 'N/A';
    
    // Calculate current mileage
    let currentMileage = 0;
    if (selectedVehicle) {
      currentMileage = Number(selectedVehicle.mileage || selectedVehicle.km || 0);
    }
    const vehicleLogs = logs.filter(l => l.vehicleId === selectedAnalysisVehicle);
    if (vehicleLogs.length > 0 && currentMileage === 0) {
      currentMileage = Math.max(...vehicleLogs.map(l => Number(l.mileage || 0)));
    }

    try {
      const response = await fetch('/api/gemini/maintenance-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix,
          currentMileage,
          logs: vehicleLogs.map(l => ({
            type: l.type,
            mileage: l.mileage,
            date: l.date,
            description: l.description,
            status: l.status,
          })),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setAnalysisResult(`ANÁLISE TÉCNICA (MODO LOCAL) • Viatura ${prefix || 'N/A'}
• Quilometragem Registada: ${currentMileage} KM
• Recomendação: Realizar verificação periódica aos travões, suspensão e níveis de óleo antes da próxima escala no Moxico.`);
      } else {
        const data = await response.json();
        setAnalysisResult(data.text || 'Não foi possível gerar análise técnica.');
      }
    } catch (error) {
      console.error('Error running maintenance analysis:', error);
      setAnalysisResult('Ocorreu um erro ao ligar ao motor de IA. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'gerente' || user?.email === 'joseiwezasuana@gmail.com';
  const isContabilista = user?.role === 'contabilista';

  const [formData, setFormData] = useState({
    vehicleId: '',
    prefix: '',
    type: 'Troca de Óleo',
    mileage: '',
    date: new Date().toISOString().split('T')[0],
    cost: '',
    status: 'planned',
    description: '',
    itemsUsed: [] as { itemId: string, name: string, quantity: number }[]
  });

  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [materialQty, setMaterialQty] = useState(1);

  const openNewModal = () => {
    setEditingLog(null);
    setFormData({
      vehicleId: '',
      prefix: '',
      type: 'Troca de Óleo',
      mileage: '',
      date: new Date().toISOString().split('T')[0],
      cost: '',
      status: 'planned',
      description: '',
      itemsUsed: []
    });
    setIsModalOpen(true);
  };

  const openEditModal = (log: any) => {
    setEditingLog(log);
    setFormData({
      vehicleId: log.vehicleId || '',
      prefix: log.prefix || '',
      type: log.type || 'Troca de Óleo',
      mileage: String(log.mileage || ''),
      date: log.date || new Date().toISOString().split('T')[0],
      cost: String(log.cost || ''),
      status: log.status || 'planned',
      description: log.description || '',
      itemsUsed: log.itemsUsed || []
    });
    setIsModalOpen(true);
  };

  const handleQuickComplete = (log: any) => {
    requestConfirm(
      "Concluir Manutenção",
      `Pretende marcar a manutenção da viatura ${log.prefix} como concluída? As peças utilizadas serão retiradas do inventário.`,
      async () => {
        try {
          const batch = writeBatch(db);
          const logRef = doc(db, 'maintenance_logs', log.id);
          
          batch.update(logRef, {
            status: 'completed',
            deducted: true
          });
          
          const itemsUsed = log.itemsUsed || [];
          for (const itemUsage of itemsUsed) {
            const itemDocRef = doc(db, 'warehouse_inventory', itemUsage.itemId);
            const item = inventory.find(i => i.id === itemUsage.itemId);
            if (item) {
              batch.update(itemDocRef, {
                stock: item.stock - itemUsage.quantity,
                updatedAt: serverTimestamp()
              });

              const logMoveRef = doc(collection(db, 'warehouse_logs'));
              batch.set(logMoveRef, {
                itemId: itemUsage.itemId,
                itemName: itemUsage.name,
                quantity: itemUsage.quantity,
                type: 'maintenance',
                timestamp: serverTimestamp(),
                user: user?.name || 'Sistema',
                vehicleId: log.vehicleId,
                maintenanceId: log.id
              });
            }
          }
          
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `maintenance_logs/${log.id}/complete`);
          alert("Erro ao concluir manutenção.");
        }
      }
    );
  };

  useEffect(() => {
    const q = query(collection(db, 'maintenance_logs'), orderBy('date', 'desc'));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'maintenance_logs'));

    const qVehicles = query(collection(db, 'drivers'), orderBy('prefix', 'asc'));
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    const qMasterVehicles = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubscribeMaster = onSnapshot(qMasterVehicles, (snapshot) => {
      setMasterVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'master_vehicles'));

    const qInventory = query(collection(db, 'warehouse_inventory'), orderBy('name', 'asc'));
    const unsubscribeInventory = onSnapshot(qInventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'warehouse_inventory'));

    return () => {
      unsubscribeLogs();
      unsubscribeVehicles();
      unsubscribeMaster();
      unsubscribeInventory();
    };
  }, []);

  const addMaterial = () => {
    if (!selectedMaterial) return;
    const item = inventory.find(i => i.id === selectedMaterial);
    if (!item) return;

    if (item.stock < materialQty) {
      alert("Stock insuficiente!");
      return;
    }

    const existing = formData.itemsUsed.find(i => i.itemId === selectedMaterial);
    if (existing) {
      setFormData({
        ...formData,
        itemsUsed: formData.itemsUsed.map(i => 
          i.itemId === selectedMaterial ? { ...i, quantity: i.quantity + materialQty } : i
        )
      });
    } else {
      setFormData({
        ...formData,
        itemsUsed: [...formData.itemsUsed, { itemId: item.id, name: item.name, quantity: materialQty }]
      });
    }
    setSelectedMaterial('');
    setMaterialQty(1);
  };

  const removeMaterial = (itemId: string) => {
    setFormData({
      ...formData,
      itemsUsed: formData.itemsUsed.filter(i => i.itemId !== itemId)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVehicle = masterVehicles.find(v => v.id === formData.vehicleId) || vehicles.find(v => v.id === formData.vehicleId);
    
    try {
      const batch = writeBatch(db);
      
      // Add or update maintenance log
      const logRef = editingLog ? doc(db, 'maintenance_logs', editingLog.id) : doc(collection(db, 'maintenance_logs'));
      
      const wasDeductedBefore = editingLog?.deducted || false;
      const isCompletedNow = formData.status === 'completed';
      
      const logData = {
        ...formData,
        prefix: selectedVehicle?.prefix || 'N/A',
        mileage: Number(formData.mileage),
        cost: Number(formData.cost),
        timestamp: editingLog ? (editingLog.timestamp || new Date().toISOString()) : new Date().toISOString(),
        deducted: isCompletedNow
      };

      if (editingLog) {
        batch.update(logRef, logData);
      } else {
        batch.set(logRef, logData);
      }

      // If completed, deduct/adjust items from inventory
      if (isCompletedNow) {
        if (!wasDeductedBefore) {
          // Case A: Newly completed. Deduct all itemsUsed
          for (const itemUsage of formData.itemsUsed) {
            const itemDocRef = doc(db, 'warehouse_inventory', itemUsage.itemId);
            const item = inventory.find(i => i.id === itemUsage.itemId);
            if (item) {
              batch.update(itemDocRef, {
                stock: item.stock - itemUsage.quantity,
                updatedAt: serverTimestamp()
              });

              // Log movement
              const logMoveRef = doc(collection(db, 'warehouse_logs'));
              batch.set(logMoveRef, {
                itemId: itemUsage.itemId,
                itemName: itemUsage.name,
                quantity: itemUsage.quantity,
                type: 'maintenance',
                timestamp: serverTimestamp(),
                user: user?.name || 'Sistema',
                vehicleId: formData.vehicleId,
                maintenanceId: logRef.id
              });
            }
          }
        } else {
          // Case B: Already completed & deducted, but items could have changed. Calculate differences.
          const oldItemsMap = new Map<string, number>();
          for (const oldItem of (editingLog.itemsUsed || [])) {
            oldItemsMap.set(oldItem.itemId, oldItem.quantity);
          }

          const newItemsMap = new Map<string, number>();
          for (const newItem of formData.itemsUsed) {
            newItemsMap.set(newItem.itemId, newItem.quantity);
          }

          const allItemIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);

          for (const itemId of allItemIds) {
            const oldQty = oldItemsMap.get(itemId) || 0;
            const newQty = newItemsMap.get(itemId) || 0;
            const diff = newQty - oldQty; // Positive = more items used (deduct), Negative = items returned (add back)

            if (diff !== 0) {
              const itemDocRef = doc(db, 'warehouse_inventory', itemId);
              const item = inventory.find(i => i.id === itemId);
              if (item) {
                batch.update(itemDocRef, {
                  stock: item.stock - diff,
                  updatedAt: serverTimestamp()
                });

                // Log movement
                const logMoveRef = doc(collection(db, 'warehouse_logs'));
                batch.set(logMoveRef, {
                  itemId: itemId,
                  itemName: item.name,
                  quantity: Math.abs(diff),
                  type: diff > 0 ? 'maintenance_output_adjust' : 'maintenance_input_adjust',
                  timestamp: serverTimestamp(),
                  user: user?.name || 'Sistema',
                  vehicleId: formData.vehicleId,
                  maintenanceId: logRef.id
                });
              }
            }
          }
        }
      } else if (wasDeductedBefore) {
        // Case C: Transitioned from completed to pending/planned. Return all items back to stock!
        for (const itemUsage of (editingLog.itemsUsed || [])) {
          const itemDocRef = doc(db, 'warehouse_inventory', itemUsage.itemId);
          const item = inventory.find(i => i.id === itemUsage.itemId);
          if (item) {
            batch.update(itemDocRef, {
              stock: item.stock + itemUsage.quantity,
              updatedAt: serverTimestamp()
            });

            // Log movement
            const logMoveRef = doc(collection(db, 'warehouse_logs'));
            batch.set(logMoveRef, {
              itemId: itemUsage.itemId,
              itemName: itemUsage.name,
              quantity: itemUsage.quantity,
              type: 'maintenance_returned',
              timestamp: serverTimestamp(),
              user: user?.name || 'Sistema',
              vehicleId: formData.vehicleId,
              maintenanceId: logRef.id
            });
          }
        }
      }

      await batch.commit();
      
      setIsModalOpen(false);
      setEditingLog(null);
      setFormData({
        vehicleId: '',
        prefix: '',
        type: 'Troca de Óleo',
        mileage: '',
        date: new Date().toISOString().split('T')[0],
        cost: '',
        status: 'planned',
        description: '',
        itemsUsed: []
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'maintenance_logs/batch');
      alert("Erro ao registar manutenção.");
    }
  };

  const deleteMaintenance = (id: string) => {
    const log = logs.find(l => l.id === id);
    requestConfirm(
      "Eliminar Registo",
      `Deseja realmente eliminar este registo de manutenção da viatura ${log?.prefix || ''}? Esta ação é irreversível e irá restaurar os materiais ao inventário.`,
      async () => {
        try {
          const batch = writeBatch(db);
          
          // If the log was completed and deducted, restore material stock to inventory
          if (log && log.status === 'completed' && log.deducted) {
            const itemsUsed = log.itemsUsed || [];
            for (const itemUsage of itemsUsed) {
              const itemDocRef = doc(db, 'warehouse_inventory', itemUsage.itemId);
              const item = inventory.find(i => i.id === itemUsage.itemId);
              if (item) {
                batch.update(itemDocRef, {
                  stock: item.stock + itemUsage.quantity,
                  updatedAt: serverTimestamp()
                });

                // Log movement
                const logMoveRef = doc(collection(db, 'warehouse_logs'));
                batch.set(logMoveRef, {
                  itemId: itemUsage.itemId,
                  itemName: itemUsage.name,
                  quantity: itemUsage.quantity,
                  type: 'maintenance_deleted_restore',
                  timestamp: serverTimestamp(),
                  user: user?.name || 'Sistema',
                  vehicleId: log.vehicleId,
                  maintenanceId: id
                });
              }
            }
          }
          
          batch.delete(doc(db, 'maintenance_logs', id));
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `maintenance_logs/${id}`);
        }
      }
    );
  };

  const handleResetCycle = () => {
    if (!isAdmin) return;
    requestConfirm(
      "Zerar Ciclo de Manutenção",
      "Deseja zerar o ciclo de manutenção? Todos os registos concluídos serão arquivados e removidos da vista principal.",
      async () => {
        setIsProcessing(true);
        try {
          // Archive completed logs
          const toArchive = logs.filter(log => log.status === 'completed');
          for (const log of toArchive) {
            await updateDoc(doc(db, 'maintenance_logs', log.id), { status: 'archived' });
          }
          alert('Ciclo reiniciado! Registos concluídos foram arquivados.');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'maintenance_logs/archive');
          alert("Erro ao reiniciar ciclo.");
        } finally {
          setIsProcessing(false);
        }
      }
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'planned': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const filteredLogs = logs.filter(log => {
    // Basic search filtering
    const matchesSearch = 
      log.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filter by tab/status
    if (filter === 'archived') return log.status === 'archived';
    if (log.status === 'archived') return false;
    if (filter === 'all') return true;
    if (filter.length === 7) return log.date?.startsWith(filter);
    return log.status === filter;
  });

  const months = Array.from(new Set(logs.map(l => l.date?.slice(0, 7)))).sort().reverse();

  const exportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text('PSM COMERCIAL LUENA MOXICO', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Histórico de Manutenções', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Filtro: ${filter === 'all' ? 'Todo' : filter} | Relatório em: ${today}`, 105, 32, { align: 'center' });

    const tableData = filteredLogs.map(log => [
      log.prefix,
      `${log.type}${log.itemsUsed?.length ? '\nPeças: ' + log.itemsUsed.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') : ''}`,
      log.date,
      `${(log.cost || 0).toLocaleString()} Kz`,
      log.status === 'completed' ? 'Concluído' : 'Pendente'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Viatura', 'Serviço', 'Data', 'Custo', 'Estado']],
      body: tableData,
    });

    doc.save(`manutencao_psm_${filter}_${Date.now()}.pdf`);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="bg-white px-6 py-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="font-black text-xl text-slate-900 tracking-tight uppercase">Saúde da Viatura</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão Técnica de Manutenções • Luena</p>
          </div>
        </div>
        {!isContabilista && (
          <div className="flex gap-2">
            {isAdmin && (
              <button 
                onClick={handleResetCycle}
                disabled={isProcessing}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-black transition-all uppercase tracking-widest active:scale-95 border border-rose-100 italic"
              >
                {isProcessing ? <Clock className="animate-spin" size={14} /> : <Trash2 size={16} />}
                Zerar Ciclo
              </button>
            )}
            <button 
              onClick={exportPDF}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-black transition-all uppercase tracking-widest active:scale-95 border border-slate-200"
            >
              Exportar PDF
            </button>
            <button 
              onClick={openNewModal}
              className="bg-brand-primary hover:bg-brand-secondary text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-xs font-black shadow-lg shadow-brand-primary/20 transition-all uppercase tracking-widest active:scale-95"
            >
              <Plus size={16} />
              Registar Manutenção
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo Total (Mês)</p>
            <TrendingUp size={14} className="text-brand-primary" />
          </div>
          <p className="text-2xl font-black text-brand-primary">
            {logs.reduce((acc, curr) => acc + (curr.cost || 0), 0).toLocaleString()} Kz
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manutenções Pendentes</p>
            <Clock size={14} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-500">
            {logs.filter(l => l.status === 'planned').length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viaturas com Alerta</p>
            <AlertCircle size={14} className="text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-500">2</p>
        </div>
      </div>

      {/* Bloco de Análise Preditiva de Manutenção - IA Gemini */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
              <Wrench size={16} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white">Análise Preditiva de Revisões (IA Gemini 1.5 Flash)</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Diagnóstico Inteligente baseado em Quilometragem e Histórico</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-amber-400/10 text-amber-400 text-[8px] font-black rounded uppercase tracking-widest border border-amber-400/20">
            Inteligência Artificial
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Viatura para Análise</label>
            <select
              value={selectedAnalysisVehicle}
              onChange={(e) => {
                setSelectedAnalysisVehicle(e.target.value);
                setAnalysisResult('');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="" className="text-slate-500">Escolha um veículo...</option>
              {masterVehicles.length > 0 && (
                <optgroup label="Frota Master (Permanente)" className="bg-slate-950 text-slate-400">
                  {masterVehicles.map(v => (
                    <option key={v.id} value={v.id} className="text-white">{v.prefix} - {v.brand} ({v.plate})</option>
                  ))}
                </optgroup>
              )}
              {vehicles.length > 0 && (
                <optgroup label="Frota Ativa (Condutores)" className="bg-slate-950 text-slate-400">
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id} className="text-white">{v.prefix} - {v.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={runMaintenanceAnalysis}
              disabled={isAnalyzing || !selectedAnalysisVehicle}
              className={cn(
                "w-full bg-brand-primary hover:bg-brand-secondary disabled:bg-slate-800 disabled:text-slate-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer",
                selectedAnalysisVehicle && !isAnalyzing ? "shadow-brand-primary/20 hover:shadow-brand-primary/30" : ""
              )}
            >
              {isAnalyzing ? (
                <>
                  <Clock className="animate-spin text-amber-400" size={14} />
                  A Analisar...
                </>
              ) : (
                <>
                  <Wrench size={14} className="text-amber-400" />
                  Gerar Previsão
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-5 text-left md:text-right">
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-wide leading-relaxed">
              O modelo cruzará os quilómetros percorridos da viatura selecionada com as datas das últimas trocas de consumíveis e as condições de Luena.
            </p>
          </div>
        </div>

        {/* Resultados */}
        <AnimatePresence mode="wait">
          {isAnalyzing && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-slate-950/60 rounded-xl p-5 border border-slate-800/80 text-center py-10 space-y-3"
            >
              <div className="flex justify-center">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-amber-400 animate-spin" />
                  <Wrench size={18} className="text-amber-400 animate-bounce" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-slate-300">Consultar Motor Cognitivo Gemini</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase">A analisar ciclos de desgaste de óleo, travões e poeira do Moxico...</p>
              </div>
            </motion.div>
          )}

          {!isAnalyzing && analysisResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-950 rounded-xl p-5 border border-slate-800/80 space-y-3 relative overflow-hidden"
            >
              {/* Decorative side accent */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
              
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Wrench size={10} /> Relatório de Diagnóstico de Saúde IA
                </p>
                <button
                  type="button"
                  onClick={() => setAnalysisResult('')}
                  className="text-[9px] text-slate-500 hover:text-white font-black uppercase tracking-widest"
                >
                  Limpar
                </button>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed font-bold font-sans whitespace-pre-line">
                {analysisResult}
              </div>
              
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center">
                <p className="text-[8px] text-slate-600 font-black uppercase tracking-wider">
                  PSM COMERCIAL LUENA • GESTÃO PREDITIVA
                </p>
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider italic">
                  *As estimativas consideram clima arenoso e vias secundárias
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
          <div className="flex items-center gap-3">
             <Filter size={14} className="text-slate-400" />
             <div className="flex gap-2">
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest px-3 py-1 outline-none focus:border-brand-primary"
                >
                  <option value="all">Todo Histórico</option>
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {['planned', 'completed', 'archived'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all",
                      filter === f ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
                    )}
                  >
                    {f === 'planned' ? 'Planeado' : f === 'completed' ? 'Concluído' : 'Histórico (C)'}
                  </button>
                ))}
             </div>
          </div>

          <div className="relative flex-1 max-w-md flex items-center">
            <Search className="absolute left-3 text-slate-400 pointer-events-none" size={14} />
            <input 
              type="text"
              placeholder="Pesquisar por viatura, serviço ou notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-primary shadow-sm"
            />
            <button
              type="button"
              onClick={() => {
                setQrTarget('search');
                setIsQrReaderOpen(true);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-brand-primary transition-colors hover:bg-slate-100 rounded cursor-pointer flex items-center justify-center"
              title="Pesquisar por QR Code"
            >
              <QrCode size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Viatura</th>
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Data Planeada</th>
                <th className="px-6 py-4">Custo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Truck size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 tracking-tight">{log.prefix}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{log.mileage?.toLocaleString()} KM</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">{log.type}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {log.itemsUsed && log.itemsUsed.length > 0 ? (
                        log.itemsUsed.map((item: any, idx: number) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black rounded uppercase tracking-tighter">
                            {item.quantity}x {item.name}
                          </span>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 line-clamp-1 italic">{log.description || 'Sem detalhes'}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500 font-mono">
                    {log.date}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-black text-slate-800 tracking-tight">{log.cost?.toLocaleString()} Kz</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                      getStatusStyle(log.status)
                    )}>
                      {log.status === 'completed' ? 'Concluído' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {!isContabilista && (
                         <>
                           {log.status === 'planned' && (
                             <button 
                               onClick={() => handleQuickComplete(log)}
                               className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                               title="Concluir Manutenção"
                             >
                               <CheckCircle2 size={18} />
                             </button>
                           )}
                           <button 
                             onClick={() => deleteMaintenance(log.id)}
                             className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                             title="Eliminar"
                           >
                             <Trash2 size={18} />
                           </button>
                         </>
                       )}
                       <button 
                         onClick={() => openEditModal(log)}
                         className="p-2 text-slate-400 hover:text-brand-primary transition-colors"
                         title="Editar Registo"
                       >
                         <ChevronRight size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Wrench size={40} className="text-slate-300" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum registo de manutenção</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto border border-slate-100 z-10"
            >
              <div className="px-6 sm:px-8 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                   <h3 className="text-base sm:text-lg font-black uppercase tracking-tighter">{editingLog ? 'Editar Manutenção' : 'Registar Manutenção'}</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{editingLog ? 'Atualização de intervenção técnica' : 'Início de intervenção técnica'}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viatura (Prefixo)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQrTarget('vehicle');
                          setIsQrReaderOpen(true);
                        }}
                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-primary hover:text-brand-secondary transition-colors cursor-pointer"
                      >
                        <Camera size={12} />
                        Escanear (QR)
                      </button>
                    </div>
                    <select 
                      required
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="">Seleccionar Viatura...</option>
                      {masterVehicles.length > 0 && (
                        <optgroup label="Frota Master (Permanente)">
                          {masterVehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.prefix} - {v.brand} ({v.plate})</option>
                          ))}
                        </optgroup>
                      )}
                      {vehicles.length > 0 && (
                        <optgroup label="Frota Ativa (Condutores)">
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.prefix} - {v.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Serviço</label>
                    <select 
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="Troca de Óleo">Troca de Óleo</option>
                      <option value="Travões">Sistema de Travões</option>
                      <option value="Pneus">Substituição de Pneus</option>
                      <option value="Seguro">Seguro Automóvel</option>
                      <option value="Inspeção">Inspeção Periódica</option>
                      <option value="Outro">Outro Reparo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quilometragem (KM)</label>
                    <input 
                      type="number"
                      required
                      value={formData.mileage}
                      onChange={(e) => setFormData({...formData, mileage: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                      placeholder="Ex: 45000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo Estimado (Kz)</label>
                    <input 
                      type="number"
                      required
                      value={formData.cost}
                      onChange={(e) => setFormData({...formData, cost: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                      placeholder="Ex: 15000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                    <select 
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="planned">Planeado / Pendente</option>
                      <option value="completed">Concluído</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações / Detalhes</label>
                  <textarea 
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary resize-none"
                    placeholder="Descreva o que será feito na viatura..."
                  />
                </div>

                {/* Peças e Materiais */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                       <Box size={14} className="text-brand-primary" />
                       Peças & Materiais Utilizados
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQrTarget('material');
                        setIsQrReaderOpen(true);
                      }}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-primary hover:text-brand-secondary transition-colors cursor-pointer"
                    >
                      <Camera size={12} />
                      Escanear Peça (QR)
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      value={selectedMaterial}
                      onChange={(e) => setSelectedMaterial(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="">Seleccione a peça...</option>
                      {inventory.map(i => (
                        <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                          {i.name} ({i.stock} {i.unit})
                        </option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      min="1"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(Number(e.target.value))}
                      className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-center outline-none"
                    />
                    <button 
                      type="button"
                      onClick={addMaterial}
                      className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {formData.itemsUsed.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {formData.itemsUsed.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
                           <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                              <span className="text-[10px] font-bold text-slate-700">{item.name}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-900">{item.quantity} un</span>
                              <button 
                                type="button"
                                onClick={() => removeMaterial(item.itemId)}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 size={12} />
                              </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.itemsUsed.length === 0 && (
                    <p className="text-[9px] text-slate-400 italic text-center font-bold font-italic">Nenhuma peça adicionada</p>
                  )}
                </div>

                <div className="pt-4 pb-2 flex gap-3 sticky bottom-0 bg-white/95 backdrop-blur-sm -mx-2 px-2">
                   <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 sm:px-6 py-3.5 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                   >
                     Cancelar
                   </button>
                   <button 
                    type="submit"
                    className="flex-2 bg-brand-primary text-white py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary transition-all active:scale-95 cursor-pointer"
                   >
                     Guardar Registo
                   </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(null)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white mb-2">
                  <AlertCircle size={24} className="text-amber-500" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{confirmDialog.title}</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1.5 leading-relaxed">{confirmDialog.message}</p>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      confirmDialog.onConfirm();
                      setConfirmDialog(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <QrScannerModal
        isOpen={isQrReaderOpen}
        onClose={() => setIsQrReaderOpen(false)}
        onScanSuccess={handleQrScanSuccess}
        title={
          qrTarget === 'search' 
            ? 'Pesquisar Viatura / Serviço' 
            : qrTarget === 'vehicle' 
              ? 'Escanear Viatura (QR)' 
              : 'Escanear Peça / Material (QR)'
        }
        hint={
          qrTarget === 'vehicle'
            ? 'Aponte para o QR Code da Viatura (Prefix, Ex: TX-01)'
            : qrTarget === 'material'
              ? 'Aponte para o QR Code da Peça (ID do Material ou Nome)'
              : 'Aponte para o QR Code para pesquisar'
        }
      />
    </div>
  );
}
