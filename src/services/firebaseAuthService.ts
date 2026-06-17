import { signInWithCredential, GoogleAuthProvider, OAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import { User } from '../types';

export class FirebaseAuthService {
  static async signInWithGoogleIdToken(idToken: string): Promise<User | null> {
    try {
      console.log('Creating Google credential with ID token...');

      // Create a Google credential with the token from expo-auth-session
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      console.log('Signing in with Firebase...');
      const userCredential = await signInWithCredential(auth, googleCredential);

      console.log('Firebase sign-in successful, mapping user...');
      return this.mapFirebaseUserToUser(userCredential.user);
    } catch (error) {
      console.error('Firebase Google Sign-In Error:', error);
      throw error;
    }
  }

  static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Firebase Sign-Out Error:', error);
      throw error;
    }
  }

  static async signInWithAppleIdentityToken(identityToken: string, rawNonce: string): Promise<User | null> {
    try {
      console.log('Creating Apple credential with identity token...');
      const provider = new OAuthProvider('apple.com');
      const appleCredential = provider.credential({
        idToken: identityToken,
        rawNonce,
      });

      console.log('Signing in with Firebase via Apple credential...');
      const userCredential = await signInWithCredential(auth, appleCredential);

      console.log('Firebase Apple sign-in successful, mapping user...');
      return this.mapFirebaseUserToUser(userCredential.user);
    } catch (error) {
      console.error('Firebase Apple Sign-In Error:', error);
      throw error;
    }
  }

  static mapFirebaseUserToUser(firebaseUser: FirebaseUser): User {
    const providerId = firebaseUser.providerData[0]?.providerId ?? '';
    const provider = providerId.includes('apple') ? 'apple' : 'google';
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || (provider === 'apple' ? 'Apple User' : ''),
      picture: firebaseUser.photoURL || undefined,
      provider,
    };
  }

  static getCurrentUser(): User | null {
    const firebaseUser = auth.currentUser;
    return firebaseUser ? this.mapFirebaseUserToUser(firebaseUser) : null;
  }
}
