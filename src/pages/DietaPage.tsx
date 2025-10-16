import { useParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import DietCreator from "@/components/DietCreator";
import { useState } from "react";

export default function DietaPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("nutrition");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <DietCreator dietaId={id} />
      </main>
    </div>
  );
}
