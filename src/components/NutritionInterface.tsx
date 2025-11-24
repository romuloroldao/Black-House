import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DietCreator from './DietCreator';
import DietViewer from './DietViewer';
import NutritionManager from './NutritionManager';
import FoodManager from './FoodManager';
import { ChefHat, Eye, Apple, Database } from 'lucide-react';

const NutritionInterface = () => {
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="foods" className="w-full">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4">
            <TabsList className="h-14 bg-transparent">
              <TabsTrigger value="foods" className="flex items-center gap-2 px-6 py-3">
                <Apple className="w-4 h-4" />
                Lista de Alimentos
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex items-center gap-2 px-6 py-3">
                <Database className="w-4 h-4" />
                Gerenciar Alimentos
              </TabsTrigger>
              <TabsTrigger value="creator" className="flex items-center gap-2 px-6 py-3">
                <ChefHat className="w-4 h-4" />
                Criar Dieta
              </TabsTrigger>
              <TabsTrigger value="viewer" className="flex items-center gap-2 px-6 py-3">
                <Eye className="w-4 h-4" />
                Ver Dietas
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        
        <TabsContent value="foods" className="mt-0">
          <NutritionManager />
        </TabsContent>
        
        <TabsContent value="manage" className="mt-0">
          <FoodManager />
        </TabsContent>
        
        <TabsContent value="creator" className="mt-0">
          <DietCreator />
        </TabsContent>
        
        <TabsContent value="viewer" className="mt-0">
          <DietViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NutritionInterface;