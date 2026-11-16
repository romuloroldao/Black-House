import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { FolderInput, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { FoodCategoriesState } from "@/hooks/useFoodCategories";
import { UNCATEGORIZED_ID, groupByCategory, type FoodCategory } from "@/lib/food-categories";

const DRAG_MIME = "application/x-blackhouse-food";

interface ManagedFood {
  id: string;
  name: string;
}

interface FoodCategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Alimentos do grupo em contexto (a lista completa aberta). */
  foods: ManagedFood[];
  grupoLabel: string;
  state: FoodCategoriesState;
}

/** Organização pessoal da lista de substituição. Não altera alimentos, quantidades nem a dieta. */
export default function FoodCategoryManager({ open, onOpenChange, foods, grupoLabel, state }: FoodCategoryManagerProps) {
  const isMobile = useIsMobile();
  const { categories, createCategory, renameCategory, deleteCategory, moveFoods } = state;
  const [novoNome, setNovoNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState("");
  const [toDelete, setToDelete] = useState<FoodCategory | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const sortedFoods = useMemo(
    () => [...foods].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [foods],
  );
  const sections = useMemo(
    () => groupByCategory(sortedFoods, (f) => f.id, categories, { keepEmpty: true }),
    [sortedFoods, categories],
  );
  const groupFoodIds = useMemo(() => new Set(foods.map((f) => f.id)), [foods]);
  const orderedCategories = useMemo(
    () => sections.filter((s) => s.id !== UNCATEGORIZED_ID).map((s) => ({ id: s.id, nome: s.nome })),
    [sections],
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome || creating) return;
    setCreating(true);
    const created = await createCategory(nome);
    setCreating(false);
    if (created) setNovoNome("");
  };

  const commitRename = async () => {
    const id = editingId;
    const nome = editingNome.trim();
    setEditingId(null);
    const current = categories.find((c) => c.id === id);
    if (!id || !nome || !current || current.nome === nome) return;
    await renameCategory(id, nome);
  };

  const move = (foodId: string, sectionId: string) => {
    const target = sectionId === UNCATEGORIZED_ID ? null : sectionId;
    const current = categories.find((c) => c.alimento_ids.includes(foodId))?.id ?? null;
    if (current === target) return;
    void moveFoods([foodId], target);
  };

  const onDrop = (e: DragEvent, sectionId: string) => {
    e.preventDefault();
    setDropTarget(null);
    const foodId = e.dataTransfer.getData(DRAG_MIME);
    if (foodId) move(foodId, sectionId);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn("flex flex-col gap-4 p-0", isMobile ? "max-h-[92dvh] rounded-t-2xl" : "w-full sm:max-w-md")}
        >
          <SheetHeader className="space-y-1 px-5 pt-5 text-left">
            <SheetTitle>Categorias de alimentos</SheetTitle>
            <SheetDescription>
              Organize a sua lista de substituição. Vale para todas as dietas dos seus alunos e não altera
              alimentos, quantidades nem valores nutricionais. Mostrando o grupo <strong>{grupoLabel}</strong>.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreate} className="flex gap-2 px-5">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nova categoria (ex.: Tubérculos)"
              maxLength={60}
              aria-label="Nome da nova categoria"
              className="h-9"
            />
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!novoNome.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1">Criar</span>
            </Button>
          </form>

          <p className="px-5 text-xs text-muted-foreground">
            {isMobile ? "Toque em" : "Arraste os alimentos entre as categorias ou use"}{" "}
            <FolderInput className="inline h-3.5 w-3.5 align-text-bottom" /> para mover.
          </p>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5">
            {sections.map((section) => {
              const category = categories.find((c) => c.id === section.id);
              const outros = category ? category.alimento_ids.filter((id) => !groupFoodIds.has(id)).length : 0;
              const isEditing = editingId === section.id;
              return (
                <section
                  key={section.id}
                  aria-label={section.nome}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropTarget !== section.id) setDropTarget(section.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                  }}
                  onDrop={(e) => onDrop(e, section.id)}
                  className={cn(
                    "rounded-lg border transition-colors",
                    section.id === UNCATEGORIZED_ID && "border-dashed",
                    dropTarget === section.id && "border-primary bg-primary/5",
                  )}
                >
                  <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editingNome}
                        maxLength={60}
                        onChange={(e) => setEditingNome(e.target.value)}
                        onBlur={() => void commitRename()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitRename();
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        aria-label="Novo nome da categoria"
                        className="h-7 text-sm"
                      />
                    ) : (
                      <h4 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.nome}{" "}
                        <span className="font-normal normal-case tracking-normal">
                          · {section.items.length}
                          {outros > 0 ? ` (+${outros} de outros grupos)` : ""}
                        </span>
                      </h4>
                    )}
                    {category && !isEditing ? (
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Renomear ${category.nome}`}
                          onClick={() => {
                            setEditingId(category.id);
                            setEditingNome(category.nome);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          aria-label={`Excluir ${category.nome}`}
                          onClick={() => setToDelete(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </header>
                  {section.items.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">
                      {section.id === UNCATEGORIZED_ID
                        ? "Todos os alimentos deste grupo estão organizados."
                        : "Arraste alimentos para cá."}
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {section.items.map((food) => (
                        <li
                          key={food.id}
                          draggable={!isMobile}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_MIME, food.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDropTarget(null)}
                          className="flex items-center gap-2 px-2 py-1.5 text-sm"
                        >
                          {!isMobile ? (
                            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{food.name}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                aria-label={`Mover ${food.name}`}
                              >
                                <FolderInput className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                              <DropdownMenuLabel className="text-xs">Mover para</DropdownMenuLabel>
                              {orderedCategories.length === 0 ? (
                                <DropdownMenuItem disabled>Crie uma categoria primeiro</DropdownMenuItem>
                              ) : (
                                orderedCategories.map((c) => (
                                  <DropdownMenuItem
                                    key={c.id}
                                    disabled={c.id === section.id}
                                    onSelect={() => move(food.id, c.id)}
                                  >
                                    {c.nome}
                                  </DropdownMenuItem>
                                ))
                              )}
                              {section.id !== UNCATEGORIZED_ID ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => move(food.id, UNCATEGORIZED_ID)}>
                                    Tirar da categoria
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a categoria “{toDelete?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {toDelete?.alimento_ids.length ?? 0} alimentos dela passam para “Sem categoria”. Nenhum alimento
              é apagado e as dietas não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) void deleteCategory(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir categoria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
