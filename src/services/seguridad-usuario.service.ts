import {injectable, /* inject, */ BindingScope} from '@loopback/core';
import {Credenciales, Usuario} from '../models';
import {repository} from '@loopback/repository';
import {LoginRepository, UsuarioRepository} from '../repositories';
import {FactorDeAuntenticacionPorCodigo} from '../models/factor-de-auntenticacion-por-codigo.model';
import {ConfiguracionSeguridad} from '../config/seguridad.config';
const generator = require('generate-password');
const MD5 = require("crypto-js/md5");
const jwt = require('jsonwebtoken');

@injectable({scope: BindingScope.TRANSIENT})
export class SeguridadUsuarioService {
  constructor(
    @repository(UsuarioRepository)
    public repositorioUsuario : UsuarioRepository,
    @repository(LoginRepository)
    public repositorioLogin : LoginRepository,
  ) {}

  /*
   * Crear un una clave aleatoria
   * @returns cadena aleatoria de n caracteres
  */

  //Funcion que crea la clave
  crearTextoAleatorio(n:number): string {
    const clave = generator.generate({
      length: n,
      numbers: true
    });
    return clave;
  }

 /**
 * Cifrar una cadena copn metodo md5
 * @param cadena texto a cifrar
 * @returns cadena cifrada con md5
 */

  cifrarTexto(cadena:string): string {
    const cadenaCifrada = MD5(cadena).toString();
    return cadenaCifrada;
  }

  /**
   * Se busca un usuario por sus credenciales de acceso
   * @param credenciales credenciales del usuario
   * @returns usuario encontradas o null
   */
  async identificarUsuario(credenciales: Credenciales): Promise<Usuario | null> {
    const usuario = await this.repositorioUsuario.findOne({
      where: {
        correo: credenciales.correo,
        clave: credenciales.clave,
      }
    });
    return usuario as Usuario;
  }

  /**
   * Valida un codigo de 2fa para un usuario
   * @param credenciales2fa credenciales del usuario con el codigo del 2fa
   * @returns el registro de login o null
  */
  async validarCodigo2fa(credenciales2fa: FactorDeAuntenticacionPorCodigo): Promise <Usuario | null> {
    const login = await this.repositorioLogin.findOne({
      where: {
        usuarioId: credenciales2fa.usuarioId,
        codigo2fa: credenciales2fa.codigo2fa,
        estadoCodigo2fa: false
      }
    });
    if (login){
      const usuario = await this.repositorioUsuario.findById(credenciales2fa.usuarioId);
      return usuario;
    }
    return null;
  }

  /**
   * generación de JWT
   * @param usuario información del usuario
   * @returns token
   */
  crearToken(usuario: Usuario): string {
    const datos = {
      name: `${usuario.primerNombre} ${usuario.segundoNombre} ${usuario.primerApellido} ${usuario.segundoApellido}`,
      role: usuario.rolId,
      email: usuario.correo
    }
    const token = jwt.sign(datos , ConfiguracionSeguridad.claveJWT);
    return token
  }

  /**
   * Valida y Obtiene el rol de un token
   * @param token token de autenticación
   * @returns el Id del rol del usuario
   */
  obtenerRolDesdeToken(token: string): string {
    const obj = jwt.verify(token, ConfiguracionSeguridad.claveJWT);
    return obj.role;
  }

}
