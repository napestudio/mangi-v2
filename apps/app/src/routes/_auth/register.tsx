import { registerPayloadSchema, type RegisterPayload } from "@mangiar/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister } from "@/hooks/useAuth";

export const Route = createFileRoute("/_auth/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterPayload>({ resolver: zodResolver(registerPayloadSchema) });

  const onSubmit = handleSubmit((values) => {
    registerMutation.mutate(values, {
      onSuccess: () => navigate({ to: "/" }),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Registrá tu restaurante en Mangiar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="restaurantName">Nombre del restaurante</Label>
            <Input id="restaurantName" {...register("restaurantName")} />
            {errors.restaurantName && <p className="text-xs text-red-600">{errors.restaurantName.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Usuario</Label>
            <Input id="username" {...register("username")} />
            {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>
          {registerMutation.isError && <p className="text-sm text-red-600">No se pudo crear la cuenta</p>}
          <Button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-medium text-neutral-900 underline">
            Iniciá sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
