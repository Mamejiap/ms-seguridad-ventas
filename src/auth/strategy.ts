import {AuthenticationBindings, AuthenticationMetadata, AuthenticationStrategy} from '@loopback/authentication';
import {inject, service} from '@loopback/core';
import {Request, HttpErrors } from '@loopback/rest';
import {UserProfile} from '@loopback/security';
import parseBearerToken from 'parse-bearer-token';
import {SeguridadUsuarioService} from '../services';
import {repository} from '@loopback/repository';
import {RolMenuRepository} from '../repositories';


export class AuthStrategy implements AuthenticationStrategy {
  name: string = 'auth';

  constructor(
    @service(SeguridadUsuarioService)
    private servicioSeguridad: SeguridadUsuarioService,
    @inject(AuthenticationBindings.METADATA)
    private metadata: AuthenticationMetadata[],
    @repository(RolMenuRepository)
    private respositorioRolMenu: RolMenuRepository,
  ) {

  }

  /**
   *Autenticar la solicitud de un usuario frente a una accion en la base de datos
   * @param request la solicitud con token
   * @returns el perfil del usuario, undefined cuando no tiene permisos o httpErrors[401] cuando no tiene permisos
   */

  async authenticate(request: Request): Promise<UserProfile | undefined> {
    const token = parseBearerToken(request);
    if(token){
      const idRol = this.servicioSeguridad.obtenerRolDesdeToken(token);
      const idMenu: string = this.metadata[0].options![0];
      const accion: string = this.metadata[0].options![1];
      console.log(this.metadata);

      const permiso = await this.respositorioRolMenu.findOne({
        where: {
          rolId: idRol,
          menuId: idMenu,
        }
      });
      let continuar: boolean = false
      if (permiso) {
        switch (accion) {
          case "guardar":
            continuar = permiso.guardar;
            break;

          case "editar":
            continuar = permiso.editar;
            break;

          case "listar":
            continuar = permiso.listar;
            break;

          case "eliminar":
            continuar = permiso.eliminar;
            break;

          case "descargar":
            continuar = permiso.descargar;
            break;

          default:
            throw new HttpErrors[401]("No es posible solicitar la acción porque no existe");

        }
        if(continuar){
          const perfil: UserProfile = Object.assign({
            permitido: "OK"
          });
          return perfil;
        }else{
          return undefined;
        }
      } else {
        throw new HttpErrors[401]("No es posible ejecutar la accion solicitada por falta de permisos");
      }

    }
    throw new HttpErrors[401]("No se proporciono un token valido para ejecutar la accion solicitada");
  }

}
