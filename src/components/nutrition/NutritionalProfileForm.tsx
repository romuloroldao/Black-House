import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

interface NutritionalProfile {
  peso: number;
  altura: number;
  idade: number;
  sexo: "M" | "F" | "";
  nivelAtividade: "sedentario" | "leve" | "moderado" | "intenso" | "";
  kcalPorKg: number;
  proteinaPorKg: number;
}

interface ProfileCalculations {
  metaCalorica: number;
  metaProteina: number;
  aguaMin: number;
  aguaMax: number;
}

interface NutritionalProfileFormProps {
  initialProfile?: Partial<NutritionalProfile>;
  onSave: (profile: NutritionalProfile, calculations: ProfileCalculations) => void;
}

export default function NutritionalProfileForm({ initialProfile, onSave }: NutritionalProfileFormProps) {
  const [profile, setProfile] = useState<NutritionalProfile>({
    peso: initialProfile?.peso || 0,
    altura: initialProfile?.altura || 0,
    idade: initialProfile?.idade || 0,
    sexo: initialProfile?.sexo || "",
    nivelAtividade: initialProfile?.nivelAtividade || "",
    kcalPorKg: initialProfile?.kcalPorKg || 25,
    proteinaPorKg: initialProfile?.proteinaPorKg || 1.6,
  });

  const [calculations, setCalculations] = useState<ProfileCalculations>({
    metaCalorica: 0,
    metaProteina: 0,
    aguaMin: 0,
    aguaMax: 0,
  });

  const calcularMetas = () => {
    const { peso, kcalPorKg, proteinaPorKg } = profile;
    
    if (!peso || peso <= 0) {
      return;
    }

    const metaCalorica = peso * kcalPorKg;
    const metaProteina = peso * proteinaPorKg;
    const aguaMin = peso * 25;
    const aguaMax = peso * 50;

    setCalculations({
      metaCalorica,
      metaProteina,
      aguaMin,
      aguaMax,
    });
  };

  const handleSave = () => {
    if (!profile.peso || !profile.altura || !profile.idade || !profile.sexo || !profile.nivelAtividade) {
      return;
    }
    onSave(profile, calculations);
  };

  const isFormValid = () => {
    return (
      profile.peso > 0 &&
      profile.altura > 0 &&
      profile.idade > 0 &&
      profile.sexo !== "" &&
      profile.nivelAtividade !== "" &&
      calculations.metaCalorica > 0
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Perfil Nutricional
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="peso">Peso (kg) *</Label>
            <Input
              id="peso"
              type="number"
              min="0"
              step="0.1"
              value={profile.peso || ""}
              onChange={(e) => setProfile({ ...profile, peso: parseFloat(e.target.value) || 0 })}
              onBlur={calcularMetas}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="altura">Altura (cm) *</Label>
            <Input
              id="altura"
              type="number"
              min="0"
              step="1"
              value={profile.altura || ""}
              onChange={(e) => setProfile({ ...profile, altura: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idade">Idade (anos) *</Label>
            <Input
              id="idade"
              type="number"
              min="0"
              step="1"
              value={profile.idade || ""}
              onChange={(e) => setProfile({ ...profile, idade: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sexo">Sexo *</Label>
            <Select value={profile.sexo} onValueChange={(value) => setProfile({ ...profile, sexo: value as "M" | "F" })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nivelAtividade">Nível de Atividade *</Label>
            <Select value={profile.nivelAtividade} onValueChange={(value) => setProfile({ ...profile, nivelAtividade: value as any })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentario">Sedentário</SelectItem>
                <SelectItem value="leve">Leve</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="intenso">Intenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="kcalPorKg">Kcal/kg</Label>
            <Input
              id="kcalPorKg"
              type="number"
              min="0"
              step="0.5"
              value={profile.kcalPorKg}
              onChange={(e) => setProfile({ ...profile, kcalPorKg: parseFloat(e.target.value) || 25 })}
              onBlur={calcularMetas}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proteinaPorKg">Proteína (g/kg)</Label>
            <Input
              id="proteinaPorKg"
              type="number"
              min="0"
              step="0.1"
              value={profile.proteinaPorKg}
              onChange={(e) => setProfile({ ...profile, proteinaPorKg: parseFloat(e.target.value) || 1.6 })}
              onBlur={calcularMetas}
            />
          </div>
        </div>

        <Button onClick={calcularMetas} variant="outline" className="w-full">
          <Calculator className="w-4 h-4 mr-2" />
          Calcular Metas
        </Button>

        {calculations.metaCalorica > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Meta Calórica</p>
              <p className="text-lg font-bold">{calculations.metaCalorica.toFixed(0)} kcal</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Meta Proteína</p>
              <p className="text-lg font-bold">{calculations.metaProteina.toFixed(1)} g</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Água Mín.</p>
              <p className="text-lg font-bold">{calculations.aguaMin.toFixed(0)} ml</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Água Máx.</p>
              <p className="text-lg font-bold">{calculations.aguaMax.toFixed(0)} ml</p>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={!isFormValid()} className="w-full">
          Salvar Perfil Nutricional
        </Button>
      </CardContent>
    </Card>
  );
}
