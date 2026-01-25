import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Save, 
  Youtube, 
  Calendar,
  Clock,
  Users,
  Bell,
  Video,
  Key,
  Plus,
  X
} from "lucide-react";

interface LiveFormProps {
  live?: any;
  onBack: () => void;
  onSave: () => void;
}

const LiveForm = ({ live, onBack, onSave }: LiveFormProps) => {
  const [formData, setFormData] = useState({
    title: live?.title || "",
    description: live?.description || "",
    scheduledDate: live?.scheduledDate || "",
    scheduledTime: live?.scheduledTime || "",
    duration: live?.duration || 60,
    visibility: live?.visibility || "active-students",
    maxParticipants: live?.maxParticipants || 50,
    youtubeStreamKey: live?.youtubeStreamKey || "",
    remindersEnabled: live?.remindersEnabled ?? true,
    autoRecord: live?.autoRecord ?? true,
    tags: live?.tags || []
  });

  const [newTag, setNewTag] = useState("");

  const visibilityOptions = [
    { value: "active-students", label: "Alunos Ativos", description: "Apenas alunos com planos ativos" },
    { value: "inactive-students", label: "Alunos Inativos", description: "Alunos com planos vencidos" },
    { value: "guests", label: "Convidados", description: "Visitantes e prospects" },
    { value: "everyone", label: "Público", description: "Todos os usuários" }
  ];

  const generateStreamKey = () => {
    const key = Array.from({ length: 16 }, () => 
      Math.random().toString(36).charAt(2)
    ).join('').match(/.{1,4}/g)?.join('-') || '';
    
    setFormData({ ...formData, youtubeStreamKey: key });
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSave = () => {
    // Aqui faria a validação e salvaria no Supabase
    console.log("Salvando live:", formData);
    onSave();
  };

  const selectedVisibility = visibilityOptions.find(opt => opt.value === formData.visibility);

  // Calcular data/hora de fim
  const endTime = formData.scheduledDate && formData.scheduledTime && formData.duration
    ? new Date(`${formData.scheduledDate}T${formData.scheduledTime}`)
    : null;
  
  if (endTime) {
    endTime.setMinutes(endTime.getMinutes() + formData.duration);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {live ? "Editar Live" : "Nova Live"}
          </h1>
          <p className="text-muted-foreground">
            {live ? "Modifique as configurações da live" : "Configure uma nova transmissão ao vivo"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="shadow-glow">
            <Save className="w-4 h-4 mr-2" />
            Salvar Live
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Básicas */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Live</CardTitle>
              <CardDescription>
                Configure os detalhes básicos da transmissão
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Live</Label>
                <Input
                  id="title"
                  placeholder="Ex: Treino HIIT ao Vivo"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o que será abordado na live..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button onClick={addTag} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agendamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agendamento
              </CardTitle>
              <CardDescription>
                Configure data, hora e duração da live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({...formData, scheduledTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  max="240"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                />
              </div>

              {endTime && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>
                      Live programada para {new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toLocaleString('pt-BR')} até {endTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações do YouTube */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                Configurações YouTube
              </CardTitle>
              <CardDescription>
                Configure a integração com o YouTube Live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stream-key">Stream Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="stream-key"
                    type="password"
                    placeholder="Chave de transmissão do YouTube"
                    value={formData.youtubeStreamKey}
                    onChange={(e) => setFormData({...formData, youtubeStreamKey: e.target.value})}
                  />
                  <Button variant="outline" onClick={generateStreamKey}>
                    <Key className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtenha sua stream key no YouTube Studio → Transmissão ao vivo
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Gravação Automática</Label>
                    <p className="text-sm text-muted-foreground">
                      Salvar automaticamente a live no YouTube
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoRecord}
                    onCheckedChange={(checked) => setFormData({...formData, autoRecord: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lembretes Automáticos</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar lembretes por email antes da live
                    </p>
                  </div>
                  <Switch
                    checked={formData.remindersEnabled}
                    onCheckedChange={(checked) => setFormData({...formData, remindersEnabled: checked})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configurações de Acesso */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Acesso</CardTitle>
              <CardDescription>
                Defina quem pode participar da live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select value={formData.visibility} onValueChange={(value) => setFormData({...formData, visibility: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visibilityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-participants">Máximo de Participantes</Label>
                <Input
                  id="max-participants"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                />
              </div>

              {selectedVisibility && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="font-medium text-sm">{selectedVisibility.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedVisibility.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <Card>
            <CardHeader>
              <CardTitle>Público Estimado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Alunos Ativos</span>
                <span className="font-medium">32</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Alunos Inativos</span>
                <span className="font-medium">8</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Convidados</span>
                <span className="font-medium">5</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>Total Elegível</span>
                <span>
                  {formData.visibility === 'everyone' ? '45' : 
                   formData.visibility === 'active-students' ? '32' :
                   formData.visibility === 'inactive-students' ? '8' : '5'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Bell className="w-4 h-4 mr-2" />
                Enviar Convites
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Video className="w-4 h-4 mr-2" />
                Testar Transmissão
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LiveForm;